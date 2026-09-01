// SquareCloud API Integration via Edge Function Proxy
import { 
  SquareLoginResponse, 
  SquareVerifyIGResponse, 
  SquareAddIGResponse,
  normalizeInstagramUsername 
} from '@/types/user';
import { supabase } from '@/integrations/supabase/client';

// Login with username and password
export const loginToSquare = async (
  username: string, 
  password: string
): Promise<{ success: boolean; daysRemaining?: number; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('square-proxy', {
      body: {
        endpoint: '/verificar-numero',
        method: 'POST',
        contentType: 'form',
        body: `numero=${encodeURIComponent(password)}&nome=${encodeURIComponent(username)}`
      }
    });

    if (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Erro ao conectar com o servidor' };
    }

    const result = data as SquareLoginResponse;

    if (result && result.senhaCorrespondente) {
      return { 
        success: true, 
        daysRemaining: result.diasRestantes || 365
      };
    } else {
      return { success: false, error: 'Usuário ou senha incorretos' };
    }
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Erro ao conectar com o servidor' };
  }
};

// Verify registered Instagram accounts for a user
export const verifyRegisteredIGs = async (
  username: string
): Promise<{ success: boolean; instagrams?: string[]; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('square-proxy', {
      body: {
        endpoint: '/verificar-usuario-instagram',
        method: 'POST',
        body: { username }
      }
    });

    if (error) {
      console.error('Verify IGs error:', error);
      return { success: false, error: 'Erro ao verificar contas' };
    }

    const result = data as SquareVerifyIGResponse;

    if (result && result.success) {
      const allIGs = [
        ...(result.igInstagram || []),
        ...(result.igTesteUserMro || [])
      ].map(ig => normalizeInstagramUsername(ig));
      
      return { success: true, instagrams: allIGs };
    } else {
      return { success: true, instagrams: [] };
    }
  } catch (error) {
    console.error('Verify IGs error:', error);
    return { success: false, error: 'Erro ao verificar contas' };
  }
};

// Check if user can register a new Instagram (has available slots)
// Returns: canRegister, alreadyExists (for sync option), error
export const canRegisterIG = async (
  username: string,
  instagram: string
): Promise<{ 
  canRegister: boolean; 
  alreadyExists: boolean;
  registeredIGs?: string[];
  error?: string 
}> => {
  try {
    const normalizedIG = normalizeInstagramUsername(instagram);
    
    // First check if user already has this IG registered
    const verifyResult = await verifyRegisteredIGs(username);
    
    if (verifyResult.success && verifyResult.instagrams) {
      // Check if IG is already registered - offer sync
      if (verifyResult.instagrams.includes(normalizedIG)) {
        return { 
          canRegister: false, 
          alreadyExists: true,
          registeredIGs: verifyResult.instagrams,
          error: 'Este Instagram já está cadastrado na sua conta. Deseja sincronizar?' 
        };
      }
      
      // Check if user has available slots (max 4 based on SquareCloud API)
      const maxIGs = 4;
      if (verifyResult.instagrams.length >= maxIGs) {
        return { 
          canRegister: false, 
          alreadyExists: false,
          registeredIGs: verifyResult.instagrams,
          error: `Limite de ${maxIGs} perfis atingido. Você não pode cadastrar mais perfis.` 
        };
      }
      
      return { 
        canRegister: true, 
        alreadyExists: false,
        registeredIGs: verifyResult.instagrams 
      };
    }
    
    return { canRegister: true, alreadyExists: false };
  } catch (error) {
    console.error('Check register error:', error);
    return { canRegister: false, alreadyExists: false, error: 'Erro ao verificar disponibilidade' };
  }
};

// Add Instagram account to user
export const addIGToSquare = async (
  username: string,
  instagram: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const normalizedIG = normalizeInstagramUsername(instagram);
    
    const { data, error } = await supabase.functions.invoke('square-proxy', {
      body: {
        endpoint: '/adicionar-ig',
        method: 'POST',
        body: { 
          newUsernameUser: username, 
          IgsUsers: normalizedIG 
        }
      }
    });

    if (error) {
      console.error('Add IG error:', error);
      return { success: false, error: 'Erro ao adicionar Instagram' };
    }

    const result = data as SquareAddIGResponse;

    if (result.success) {
      return { success: true };
    } else {
      return { success: false, error: result.message || 'Não foi possível adicionar o Instagram' };
    }
  } catch (error) {
    console.error('Add IG error:', error);
    return { success: false, error: 'Erro ao adicionar Instagram' };
  }
};

// Save email and print to SquareCloud
export const saveEmailAndPrint = async (
  email: string,
  username: string,
  instagram: string,
  printBlob: Blob
): Promise<{ success: boolean; error?: string }> => {
  try {
    const normalizedIG = normalizeInstagramUsername(instagram);
    
    // Convert blob to base64
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64.split(',')[1]);
      };
      reader.readAsDataURL(printBlob);
    });
    const base64Image = await base64Promise;

    const { data, error } = await supabase.functions.invoke('square-proxy', {
      body: {
        endpoint: '/saveEmail',
        method: 'POST',
        body: {
          email,
          newUsernameUser: username,
          IgsUsers: normalizedIG,
          dataDeEnvio: new Date().toISOString(),
          printBase64: base64Image,
          printFileName: `${normalizedIG}_profile.jpg`
        }
      }
    });

    if (error) {
      console.error('saveEmail error:', error);
      return { success: false, error: 'Erro ao salvar dados' };
    }

    return { success: true };
  } catch (error) {
    console.error('Save email/print error:', error);
    return { success: false, error: 'Erro ao enviar dados' };
  }
};

// Check how many IGs user can register
export const getAvailableIGSlots = async (
  username: string
): Promise<{ available: number; total: number }> => {
  try {
    const result = await verifyRegisteredIGs(username);
    const registered = result.instagrams?.length || 0;
    // Assuming max 6 IGs per user
    const maxIGs = 6;
    return { available: maxIGs - registered, total: maxIGs };
  } catch {
    return { available: 0, total: 6 };
  }
};
