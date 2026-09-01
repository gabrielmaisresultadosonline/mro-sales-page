import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StrategyRequest {
  profile: {
    username: string;
    fullName: string;
    bio: string;
    followers: number;
    category: string;
  };
  analysis: {
    niche: string;
    recommendations: string[];
  };
  type: 'mro' | 'content' | 'engagement' | 'sales' | 'bio';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profile, analysis, type }: StrategyRequest = await req.json();
    const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    console.log('Gerando estratégia:', type, 'para:', profile.username);

    const today = new Date();
    const todayStr = today.toLocaleDateString('pt-BR');

    const strategyPrompts: Record<string, string> = {
      mro: `Crie uma estratégia MRO Inteligente completa para @${profile.username}.

DATA DE GERAÇÃO: ${todayStr}

A ferramenta MRO INTELIGENTE funciona assim:
- Seguir + Curtir 4 fotos automaticamente
- Curtir 3-5 fotos por perfil
- Visualização automática de stories (faz em um dia)
- Curtir stories automaticamente
- NÃO FAZ comentários automáticos (não indique isso)
- Depois pode programar para deixar de seguir (limpar quem não interessa)
- Usar 1 conta de concorrente/referência por dia

Nicho: ${analysis.niche}

RETORNE JSON com:
1. "steps": passos detalhados usando MRO Inteligente
2. "mroTutorial": {
   "dailyActions": [
     {"action": "Seguir + Curtir 4 fotos", "quantity": "50-100 pessoas/dia", "description": "Usar a opção de seguir com curtidas automáticas"},
     {"action": "Curtir 3-5 fotos", "quantity": "Por perfil", "description": "Antes de seguir, curtir fotos recentes"},
     {"action": "Visualizar Stories", "quantity": "Automático", "description": "A ferramenta visualiza stories automaticamente"},
     {"action": "Curtir Stories", "quantity": "Automático", "description": "Curte stories de forma automática"}
   ],
   "unfollowStrategy": ["Programar unfollow após 3-7 dias", "Limpar quem não seguiu de volta", "Manter taxa saudável"],
   "competitorReference": "Usar 1 conta de referência/concorrente por dia como fonte de seguidores"
}
3. "scripts": scripts de vendas quando pessoas responderem
4. "storiesCalendar": calendário semanal de stories com CTAs
5. "postsCalendar": calendário de posts de 3 em 3 dias (próximos 30 dias) com:
   [{"date": "DD/MM/YYYY", "dayOfWeek": "Segunda", "postType": "Carrossel/Reels/Feed", "content": "descrição", "hashtags": ["#tag1"], "bestTime": "18:00", "cta": "CTA do post"}]
6. "metaSchedulingTutorial": [
   "1. Acesse o Meta Business Suite (business.facebook.com)",
   "2. Conecte sua conta do Instagram",
   "3. Vá em 'Conteúdo' > 'Criar publicação'",
   "4. Selecione as datas do calendário gerado",
   "5. Configure os horários recomendados",
   "6. Agende os posts de 3 em 3 dias conforme o calendário"
]`,

      content: `Crie um calendário de conteúdo completo para @${profile.username}.

DATA DE GERAÇÃO: ${todayStr}
Nicho: ${analysis.niche}

Inclua:
1. "steps": estratégia geral de conteúdo
2. "storiesCalendar": calendário semanal de Stories
3. "postsCalendar": calendário de posts de 3 em 3 dias (próximos 30 dias):
   [{"date": "DD/MM/YYYY", "dayOfWeek": "Segunda", "postType": "Carrossel/Reels/Feed", "content": "descrição detalhada", "hashtags": ["#tag1", "#tag2"], "bestTime": "18:00", "cta": "CTA específico"}]
4. "metaSchedulingTutorial": tutorial passo-a-passo para agendar no Meta Business Suite
5. "mroTutorial": {
   "dailyActions": ações diárias da MRO Inteligente,
   "unfollowStrategy": estratégia de unfollow,
   "competitorReference": "1 conta de referência por dia"
}`,

      engagement: `Crie uma estratégia de engajamento usando MRO Inteligente para @${profile.username}.

DATA DE GERAÇÃO: ${todayStr}
Nicho: ${analysis.niche}

A MRO Inteligente oferece:
- Seguir + Curtir 4 fotos automaticamente
- Visualização e curtida de Stories automática
- Opção de unfollow programado

Inclua:
1. "steps": como usar MRO para aumentar engajamento
2. "mroTutorial": ações diárias específicas
3. "storiesCalendar": calendário com foco em engajamento
4. "postsCalendar": posts de 3 em 3 dias
5. "metaSchedulingTutorial": como agendar via Meta`,

      sales: `Crie scripts de vendas completos para @${profile.username}.

DATA DE GERAÇÃO: ${todayStr}
Nicho: ${analysis.niche}

Inclua:
1. "steps": funil de vendas
2. "scripts": scripts detalhados com gatilhos
3. "storiesCalendar": stories de vendas
4. "postsCalendar": posts de 3 em 3 dias focados em conversão
5. "mroTutorial": como usar MRO para gerar leads
6. "metaSchedulingTutorial": agendamento no Meta`,

      bio: `Crie uma bio otimizada para o Instagram de @${profile.username}.

DATA DE GERAÇÃO: ${todayStr}
Nicho: ${analysis.niche}
Bio atual: "${profile.bio}"
Categoria: ${profile.category || 'Não definida'}
Seguidores: ${profile.followers}

ANALISE A BIO ATUAL e crie uma versão melhorada com:
- Proposta de valor clara no início
- O que a pessoa/empresa faz
- Benefício para quem segue
- CTA forte (Call to Action)
- Uso estratégico de emojis
- Máximo 150 caracteres

RETORNE JSON com:
1. "bioAnalysis": {
   "currentBio": "a bio atual",
   "problems": ["problema 1", "problema 2"],
   "strengths": ["ponto forte 1"]
}
2. "suggestedBios": [
   {"bio": "sugestão 1 completa", "focus": "Foco: proposta de valor"},
   {"bio": "sugestão 2 completa", "focus": "Foco: benefício"},
   {"bio": "sugestão 3 completa", "focus": "Foco: autoridade"}
]
3. "tips": ["dica 1 para melhorar bio", "dica 2", "dica 3"]
4. "steps": ["passo 1 para implementar", "passo 2"]`,
    };

    const systemPrompt = `Você é um especialista em marketing digital e vendas no Instagram.
Crie estratégias práticas focadas na ferramenta MRO Inteligente em português brasileiro.

IMPORTANTE sobre MRO Inteligente:
- Faz seguir + curtir 4 fotos automaticamente
- Visualiza e curte stories automaticamente
- NÃO comenta automaticamente
- Permite programar unfollow
- Usar 1 concorrente de referência por dia

RETORNE JSON VÁLIDO no formato:
{
  "title": "título da estratégia",
  "description": "descrição breve",
  "steps": ["passo 1 com emoji", "passo 2 com emoji", ...],
  "scripts": [
    {
      "situation": "situação",
      "opening": "frase de abertura",
      "body": "desenvolvimento",
      "closing": "fechamento",
      "scarcityTriggers": ["gatilho 1", "gatilho 2"]
    }
  ],
  "storiesCalendar": [
    {
      "day": "Segunda",
      "stories": [
        {"time": "08:00", "type": "engagement", "content": "conteúdo", "hasButton": false},
        {"time": "18:00", "type": "cta", "content": "oferta", "hasButton": true, "buttonText": "Saiba mais"}
      ]
    }
  ],
  "postsCalendar": [
    {"date": "10/12/2024", "dayOfWeek": "Terça", "postType": "Carrossel", "content": "descrição do post", "hashtags": ["#tag1"], "bestTime": "18:00", "cta": "Link na bio"}
  ],
  "mroTutorial": {
    "dailyActions": [
      {"action": "nome da ação", "quantity": "quantidade", "description": "como fazer"}
    ],
    "unfollowStrategy": ["passo 1", "passo 2"],
    "competitorReference": "usar 1 conta por dia"
  },
  "metaSchedulingTutorial": [
    "1. Passo um...",
    "2. Passo dois..."
  ]
}`;

    let strategyResult = null;

    // Tenta com DeepSeek primeiro
    if (DEEPSEEK_API_KEY) {
      try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: strategyPrompts[type] }
            ],
            temperature: 0.8,
            max_tokens: 6000,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              strategyResult = JSON.parse(jsonMatch[0]);
              console.log('DeepSeek strategy successful');
            }
          }
        }
      } catch (e) {
        console.error('DeepSeek error:', e);
      }
    }

    // Fallback para Lovable AI
    if (!strategyResult && LOVABLE_API_KEY) {
      try {
        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: strategyPrompts[type] }
            ],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              strategyResult = JSON.parse(jsonMatch[0]);
              console.log('Lovable AI strategy successful');
            }
          }
        }
      } catch (e) {
        console.error('Lovable AI error:', e);
      }
    }

    // Fallback básico
    if (!strategyResult) {
      strategyResult = generateFallbackStrategy(type, profile, analysis);
    }

    // Adiciona metadados
    strategyResult.id = `strategy_${Date.now()}`;
    strategyResult.type = type;
    strategyResult.createdAt = new Date().toISOString();

    return new Response(
      JSON.stringify({ success: true, strategy: strategyResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating strategy:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Erro ao gerar estratégia', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateFallbackStrategy(type: string, profile: any, analysis: any) {
  const today = new Date();
  
  // Generate posts calendar for next 30 days, every 3 days
  const postsCalendar = [];
  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const postTypes = ['Carrossel educativo', 'Reels com áudio viral', 'Post de valor', 'Carrossel de dicas', 'Reels bastidores', 'Post de depoimento'];
  
  for (let i = 0; i < 10; i++) {
    const postDate = new Date(today);
    postDate.setDate(postDate.getDate() + (i * 3));
    postsCalendar.push({
      date: postDate.toLocaleDateString('pt-BR'),
      dayOfWeek: dayNames[postDate.getDay()],
      postType: postTypes[i % postTypes.length],
      content: `Conteúdo sobre ${analysis.niche} - post ${i + 1}`,
      hashtags: [`#${analysis.niche.replace(/\s/g, '')}`, '#dicasinstagram', '#marketingdigital'],
      bestTime: '18:00',
      cta: 'Link na bio 👇'
    });
  }

  const mroTutorial = {
    dailyActions: [
      { action: 'Seguir + Curtir 4 fotos', quantity: '50-100 pessoas/dia', description: 'Usar a opção automática de seguir com curtidas' },
      { action: 'Curtir 3-5 fotos', quantity: 'Por perfil', description: 'Antes de seguir, curtir as fotos mais recentes' },
      { action: 'Visualizar Stories', quantity: 'Automático', description: 'A MRO visualiza stories automaticamente' },
      { action: 'Curtir Stories', quantity: 'Automático', description: 'Curte stories de forma automática' },
    ],
    unfollowStrategy: [
      'Programar unfollow após 3-7 dias',
      'Limpar quem não seguiu de volta',
      'Manter taxa seguindo/seguidores saudável',
      'Não fazer unfollow em massa no mesmo dia'
    ],
    competitorReference: 'Escolha 1 conta de concorrente ou referência por dia como fonte de seguidores qualificados'
  };

  const metaSchedulingTutorial = [
    '1. Acesse business.facebook.com e faça login',
    '2. Conecte sua conta do Instagram nas configurações',
    '3. Vá em "Conteúdo" > "Criar publicação"',
    '4. Selecione "Instagram" como destino',
    '5. Adicione a imagem/vídeo e legenda do calendário',
    '6. Clique em "Agendar" e selecione a data/hora',
    '7. Repita para cada post do calendário (3 em 3 dias)',
    '8. Monitore os agendamentos em "Conteúdo" > "Publicações"'
  ];

  const strategies: Record<string, any> = {
    mro: {
      title: `Estratégia MRO Inteligente para @${profile.username}`,
      description: `Estratégia de crescimento orgânico usando a ferramenta MRO Inteligente focada no nicho de ${analysis.niche}. Gerada em ${today.toLocaleDateString('pt-BR')}.`,
      steps: [
        '🎯 Configure a MRO Inteligente com seu público-alvo do nicho de ' + analysis.niche,
        '📍 Defina a localização para sua região de atuação',
        '🔍 Escolha 1 conta de concorrente como referência do dia',
        '⏰ Horários ideais: 8h-10h e 18h-21h',
        '👥 Meta diária: 50-100 interações usando Seguir + Curtir 4 fotos',
        '❤️ A MRO curte 3-5 fotos automaticamente por perfil',
        '👀 Visualização e curtida de Stories automática',
        '🔄 Programe unfollow após 3-7 dias para limpar',
        '📊 Monitore resultados semanalmente no painel de crescimento',
      ],
      scripts: [{
        situation: 'Cliente chegou pelo DM após interação MRO',
        opening: 'Oi! 👋 Que bom te ver por aqui! Posso te ajudar?',
        body: 'Trabalhamos com soluções personalizadas para seu negócio.',
        closing: 'Essa semana temos condições especiais. Posso explicar?',
        scarcityTriggers: ['⚡ Vagas limitadas', '🔥 Preço especial só até sexta'],
      }],
      mroTutorial,
      postsCalendar,
      metaSchedulingTutorial,
    },
    content: {
      title: `Calendário de Conteúdo para @${profile.username}`,
      description: `Estratégia semanal otimizada para máximo engajamento. Gerada em ${today.toLocaleDateString('pt-BR')}.`,
      steps: [
        '📸 Posts de 3 em 3 dias conforme calendário',
        '🎥 Alternar entre Reels, Carrosséis e Posts',
        '💡 Usar CTAs fortes em cada post',
        '📱 Stories diários com enquetes e CTAs',
        '⏰ Agendar no Meta Business Suite',
        '🔍 Usar MRO Inteligente para atrair público',
        '📊 Monitorar métricas semanalmente',
      ],
      scripts: [],
      mroTutorial,
      postsCalendar,
      metaSchedulingTutorial,
    },
    engagement: {
      title: `Estratégia de Engajamento para @${profile.username}`,
      description: `Aumente sua taxa de engajamento com MRO Inteligente. Gerada em ${today.toLocaleDateString('pt-BR')}.`,
      steps: [
        '📱 Poste Stories 5-8x por dia com enquetes',
        '💬 Responda TODOS os comentários em 1h',
        '🎯 Use CTAs fortes nos posts',
        '👥 Use MRO para interagir com público qualificado',
        '❤️ Seguir + Curtir 4 fotos de potenciais seguidores',
        '👀 Visualizar stories de forma automática',
        '🔔 Ative notificações para responder rápido',
        '🤝 Colabore com perfis do nicho',
      ],
      scripts: [],
      mroTutorial,
      postsCalendar,
      metaSchedulingTutorial,
    },
    sales: {
      title: `Scripts de Vendas para @${profile.username}`,
      description: `Scripts de alta conversão para seu nicho. Gerada em ${today.toLocaleDateString('pt-BR')}.`,
      steps: [
        '🎯 Use MRO para gerar leads qualificados',
        '💡 Qualifique o lead antes de oferecer',
        '📊 Use provas sociais nos posts',
        '⏰ Crie urgência genuína',
        '🎁 Ofereça bônus exclusivos',
        '🔄 Faça follow-up em 24/48/72h',
      ],
      scripts: [
        {
          situation: 'Primeiro contato - Lead frio',
          opening: 'Oi! 👋 Vi que você acompanha nosso conteúdo. Posso fazer uma pergunta?',
          body: 'Qual seu maior desafio hoje? Pergunto porque podemos ajudar.',
          closing: 'Se fizer sentido, posso explicar como funciona. Sem compromisso! 😊',
          scarcityTriggers: ['Resposta: aguardo seu retorno!'],
        },
        {
          situation: 'Lead quente - Demonstrou interesse',
          opening: 'Que bom que se interessou! 🔥',
          body: 'Deixa eu explicar: já ajudamos +X pessoas a conseguir resultados.',
          closing: 'Para quem fechar essa semana, tenho condição especial.',
          scarcityTriggers: ['🔥 Bônus só até amanhã', '📍 Só X vagas restantes'],
        },
      ],
      mroTutorial,
      postsCalendar,
      metaSchedulingTutorial,
    },
    bio: {
      title: `Otimização de Bio para @${profile.username}`,
      description: `Análise e sugestões de bio otimizada para ${analysis.niche}. Gerada em ${today.toLocaleDateString('pt-BR')}.`,
      steps: [
        '📝 Analise sua bio atual',
        '✨ Escolha uma das sugestões abaixo',
        '📱 Copie e cole no Instagram',
        '🔗 Adicione seu link na bio',
        '📊 Monitore o impacto nos próximos dias',
      ],
      bioAnalysis: {
        currentBio: profile.bio || 'Bio não encontrada',
        problems: ['Bio pode ser mais direta', 'Falta CTA claro', 'Proposta de valor não está clara'],
        strengths: ['Uso de emojis', 'Menciona o nicho'],
      },
      suggestedBios: [
        { bio: `🎯 ${analysis.niche} | Transformo seguidores em clientes 💰 Resultados garantidos 👇`, focus: 'Foco: conversão' },
        { bio: `✨ Especialista em ${analysis.niche} | +X clientes satisfeitos | Link abaixo 👇`, focus: 'Foco: autoridade' },
        { bio: `${analysis.niche} 🚀 Te ajudo a [benefício] | Comece agora 👇`, focus: 'Foco: benefício' },
      ],
      tips: [
        '💡 Comece com sua proposta de valor principal',
        '🎯 Use no máximo 3-4 emojis estratégicos',
        '📍 Adicione localização se for negócio local',
        '🔗 Link na bio deve levar para ação',
        '✅ Atualize a bio mensalmente',
      ],
      scripts: [],
      mroTutorial: {},
      postsCalendar: [],
      metaSchedulingTutorial: [],
    },
  };

  const strategy = strategies[type] || strategies.mro;
  strategy.storiesCalendar = generateStoriesCalendar();
  return strategy;
}

function generateStoriesCalendar() {
  const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  return days.map(day => ({
    day,
    stories: [
      { time: '08:00', type: 'engagement', content: 'Bom dia! Enquete interativa', hasButton: false },
      { time: '12:00', type: 'behind-scenes', content: 'Bastidores do dia', hasButton: false },
      { time: '15:00', type: 'cta', content: 'Novidade! Link na bio 👇', hasButton: true, buttonText: 'Saiba mais' },
      { time: '18:00', type: 'testimonial', content: 'Resultado do cliente 🔥', hasButton: false },
      { time: '21:00', type: 'offer', content: 'Última chance! ⏰', hasButton: true, buttonText: 'Aproveitar' },
    ],
  }));
}
