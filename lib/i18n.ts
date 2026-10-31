import { getLocales } from 'expo-localization';

import type { Locale } from '@/types';

/**
 * Minimal i18n: pt-BR is the default and the source of keys; English only when
 * the device language is English. Add a key to both maps — `en` is typed
 * against `ptBR`, so a missing translation fails the typecheck.
 */
const ptBR = {
  'tabs.overview': 'Início',
  'tabs.brushing': 'Escovação',
  'tabs.progress': 'Progresso',
  'tabs.more': 'Mais',

  'slots.breakfast': 'Depois do café da manhã',
  'slots.lunch': 'Depois do almoço',
  'slots.dinner': 'Depois do jantar',
  'slots.newLabel': 'Nova escovação',
  'slots.title': 'Horários de escovação',
  'slots.subtitle': 'Horários de {name}. Dias anteriores continuam com os horários daquele dia.',
  'slots.label': 'Nome',
  'slots.start': 'Início',
  'slots.end': 'Fim',
  'slots.add': 'Adicionar horário',
  'slots.remove': 'Remover {label}',
  'slots.moveUp': 'Mover {label} para cima',
  'slots.moveDown': 'Mover {label} para baixo',
  'slots.icon': 'Trocar ícone de {label}',
  'slots.errTime': 'Use o formato HH:MM, com o início antes do fim.',
  'slots.minOne': 'Cada criança precisa de pelo menos um horário.',

  'category.pain': 'Dor',
  'category.sensitivity': 'Sensibilidade',
  'category.bleeding': 'Sangramento',
  'category.filling': 'Restauração',
  'category.sealant': 'Selante',
  'category.cleaning': 'Limpeza',
  'category.extraction': 'Extração',

  'consent.title': 'Antes de começar',
  'consent.updated': 'Atualizamos nossos documentos. Leia e aceite para continuar.',
  'consent.body':
    'O Zing guarda o nome, o ano de nascimento (opcional) e as escovações de cada criança para mostrar o progresso. Leia os documentos abaixo.',
  'consent.terms': 'Termos de Uso',
  'consent.privacy': 'Política de Privacidade',
  'consent.checkbox':
    'Sou mãe, pai ou responsável legal, tenho 18 anos ou mais e aceito os Termos de Uso e a Política de Privacidade, incluindo o tratamento dos dados de escovação e de saúde bucal das crianças que eu cadastrar.',
  'consent.continue': 'Aceitar e continuar',
  'consent.signOut': 'Sair da conta',

  'childForm.titleNew': 'Adicionar criança',
  'childForm.titleEdit': 'Editar perfil',
  'childForm.subtitleFirst': 'Você pode adicionar outras crianças depois.',
  'childForm.name': 'Primeiro nome ou apelido (sem sobrenome)',
  'childForm.namePlaceholder': 'ex.: Leo',
  'childForm.icon': 'Escolha um personagem',
  'childForm.color': 'Escolha uma cor',
  'childForm.birthYear': 'Ano de nascimento (opcional)',
  'childForm.create': 'Criar perfil',
  'childForm.save': 'Salvar perfil',
  'childForm.delete': 'Excluir perfil',
  'childForm.back': 'Voltar',
  'childForm.errName': 'Digite o nome da criança.',
  'childForm.errBirthYear': 'Digite um ano entre {min} e {max}, ou deixe em branco.',
  'childForm.limit': 'Você atingiu o limite de perfis.',
  'childForm.deleteTitle': 'Excluir o perfil de {name}?',
  'childForm.deleteBody':
    'Todas as escovações e registros dentários de {name} serão apagados. Isso não pode ser desfeito.',
  'childForm.deleteConfirm': 'Excluir para sempre',
  'childForm.keep': 'Manter perfil',
  'childForm.deleteFail': 'Não foi possível excluir agora. Verifique a internet e tente de novo.',
  'childForm.brushingTimes': 'Horários de escovação',

  'picker.title': 'Quem vai escovar?',
  'picker.add': 'Adicionar criança',
  'picker.edit': 'Editar {name}',
  'picker.switchTo': 'Trocar para {name}',

  'gate.title': 'Só para adultos',
  'gate.question': 'Quanto é {a} × {b}?',
  'gate.answer': 'Resposta',
  'gate.continue': 'Continuar',
  'gate.back': 'Voltar',
  'gate.wrong': 'Não é isso. Tente esta.',

  'greeting.morning': 'Bom dia,',
  'greeting.afternoon': 'Boa tarde,',
  'greeting.evening': 'Boa noite,',
  'greeting.fallbackName': 'olá',
  'overview.today': 'Escovações de hoje',
  'overview.done': 'Feito · {time}',
  'overview.notYet': 'Ainda não',
  'overview.cta': 'Hora de escovar!',
  'overview.ctaBody': 'O Sparky está pronto, {name}.',
  'overview.start': 'Começar a escovar',

  'brushing.title': 'Escovação',
  'brushing.soon': 'A nova tela de escovação chega em breve.',
  'brushing.editTimes': 'Editar horários',

  'progress.title': 'Progresso',
  'progress.soon': 'Em breve você verá aqui o progresso de {name}.',

  'more.title': 'Mais',
  'more.children': 'Crianças',
  'more.manageChildren': 'Trocar ou adicionar criança',
  'more.account': 'Conta',
  'more.export': 'Exportar meus dados',
  'more.signOut': 'Sair',
  'more.delete': 'Excluir conta',
  'more.legal': 'Documentos',
  'more.version': 'Versão {version}',
  'more.signOutTitle': 'Sair da conta?',
  'more.signOutBody': 'Você vai precisar entrar de novo para ver o progresso das crianças.',
  'more.stay': 'Continuar conectado',
  'more.signOutFail': 'Não foi possível sair agora. Tente de novo.',
  'more.exportTitle': 'Dados do Zing',
  'more.exportFail': 'Não foi possível exportar agora. Verifique a internet e tente de novo.',
  'more.deleteTitle': 'Excluir sua conta?',
  'more.deleteBody':
    'Isso apaga sua conta e todos os dados das crianças: perfis, horários, escovações e registros dentários. Não pode ser desfeito.',
  'more.deleteConfirm': 'Excluir minha conta',
  'more.keepAccount': 'Manter conta',
  'more.passwordTitle': 'Confirme sua senha',
  'more.passwordBody': 'Por segurança, digite sua senha para excluir a conta.',
  'more.confirm': 'Confirmar',
  'more.deleteFail': 'Não foi possível excluir a conta agora. Verifique a internet e tente de novo.',
  'more.wrongPassword': 'Senha incorreta. Tente de novo.',

  'camera.title': 'Um espelho para escovar',
  'camera.body':
    'Pais: a câmera frontal funciona só como espelho, para a criança se ver enquanto escova. Nada é gravado, salvo ou enviado.',
  'camera.allow': 'Ligar o espelho',
  'camera.skip': 'Escovar sem câmera',
} as const;

export type StringKey = keyof typeof ptBR;

const en: Record<StringKey, string> = {
  'tabs.overview': 'Overview',
  'tabs.brushing': 'Brushing',
  'tabs.progress': 'Progress',
  'tabs.more': 'More',

  'slots.breakfast': 'After breakfast',
  'slots.lunch': 'After lunch',
  'slots.dinner': 'After dinner',
  'slots.newLabel': 'New brushing',
  'slots.title': 'Brushing times',
  'slots.subtitle': "{name}'s times. Past days keep the times they had that day.",
  'slots.label': 'Name',
  'slots.start': 'From',
  'slots.end': 'Until',
  'slots.add': 'Add a brushing time',
  'slots.remove': 'Remove {label}',
  'slots.moveUp': 'Move {label} up',
  'slots.moveDown': 'Move {label} down',
  'slots.icon': 'Change icon for {label}',
  'slots.errTime': 'Use HH:MM, with the start before the end.',
  'slots.minOne': 'Each child needs at least one brushing time.',

  'category.pain': 'Pain',
  'category.sensitivity': 'Sensitivity',
  'category.bleeding': 'Bleeding',
  'category.filling': 'Filling',
  'category.sealant': 'Sealant',
  'category.cleaning': 'Cleaning',
  'category.extraction': 'Extraction',

  'consent.title': 'Before you start',
  'consent.updated': "We've updated our documents. Please read and accept them to continue.",
  'consent.body':
    "Zing stores each child's name, birth year (optional) and brushing sessions to show their progress. Please read the documents below.",
  'consent.terms': 'Terms of Service',
  'consent.privacy': 'Privacy Policy',
  'consent.checkbox':
    "I am a parent or legal guardian, I am 18 or older, and I accept the Terms of Service and the Privacy Policy, including the processing of brushing and dental health data for the children I add.",
  'consent.continue': 'Accept and continue',
  'consent.signOut': 'Log out',

  'childForm.titleNew': 'Add a child',
  'childForm.titleEdit': 'Edit profile',
  'childForm.subtitleFirst': 'You can add more children later.',
  'childForm.name': 'First name or nickname (no surname)',
  'childForm.namePlaceholder': 'e.g. Leo',
  'childForm.icon': 'Pick a character',
  'childForm.color': 'Pick a color',
  'childForm.birthYear': 'Birth year (optional)',
  'childForm.create': 'Create profile',
  'childForm.save': 'Save profile',
  'childForm.delete': 'Delete profile',
  'childForm.back': 'Go back',
  'childForm.errName': "Please add the child's name.",
  'childForm.errBirthYear': 'Enter a year between {min} and {max}, or leave it blank.',
  'childForm.limit': "You've reached the profile limit.",
  'childForm.deleteTitle': "Delete {name}'s profile?",
  'childForm.deleteBody': "All of {name}'s brushing sessions and dental records will be erased. This can't be undone.",
  'childForm.deleteConfirm': 'Delete forever',
  'childForm.keep': 'Keep profile',
  'childForm.deleteFail': "We couldn't delete it right now. Check your connection and try again.",
  'childForm.brushingTimes': 'Brushing times',

  'picker.title': "Who's brushing?",
  'picker.add': 'Add a child',
  'picker.edit': 'Edit {name}',
  'picker.switchTo': 'Switch to {name}',

  'gate.title': 'Grown-ups only',
  'gate.question': 'What is {a} × {b}?',
  'gate.answer': 'Answer',
  'gate.continue': 'Continue',
  'gate.back': 'Go back',
  'gate.wrong': 'Not quite. Try this one.',

  'greeting.morning': 'Good morning,',
  'greeting.afternoon': 'Good afternoon,',
  'greeting.evening': 'Good evening,',
  'greeting.fallbackName': 'there',
  'overview.today': "Today's brushing",
  'overview.done': 'Done · {time}',
  'overview.notYet': 'Not yet',
  'overview.cta': 'Time to brush!',
  'overview.ctaBody': 'Sparky is ready, {name}.',
  'overview.start': 'Start brushing',

  'brushing.title': 'Brushing',
  'brushing.soon': 'The new brushing screen is coming soon.',
  'brushing.editTimes': 'Edit brushing times',

  'progress.title': 'Progress',
  'progress.soon': "{name}'s progress will show up here soon.",

  'more.title': 'More',
  'more.children': 'Children',
  'more.manageChildren': 'Switch or add a child',
  'more.account': 'Account',
  'more.export': 'Export my data',
  'more.signOut': 'Log out',
  'more.delete': 'Delete account',
  'more.legal': 'Legal',
  'more.version': 'Version {version}',
  'more.signOutTitle': 'Log out?',
  'more.signOutBody': "You'll need to sign in again to see your children's progress.",
  'more.stay': 'Stay signed in',
  'more.signOutFail': "We couldn't log you out right now. Please try again.",
  'more.exportTitle': 'Zing data',
  'more.exportFail': "We couldn't export right now. Check your connection and try again.",
  'more.deleteTitle': 'Delete your account?',
  'more.deleteBody':
    "This erases your account and all children's data: profiles, brushing times, sessions and dental records. It can't be undone.",
  'more.deleteConfirm': 'Delete my account',
  'more.keepAccount': 'Keep account',
  'more.passwordTitle': 'Confirm your password',
  'more.passwordBody': 'For your security, enter your password to delete the account.',
  'more.confirm': 'Confirm',
  'more.deleteFail': "We couldn't delete the account right now. Check your connection and try again.",
  'more.wrongPassword': "That password didn't match. Please try again.",

  'camera.title': 'A mirror for brushing',
  'camera.body':
    'Parents: the front camera works only as a mirror, so your child can see themselves while brushing. Nothing is recorded, saved or sent.',
  'camera.allow': 'Turn on the mirror',
  'camera.skip': 'Brush without camera',
};

export const locale: Locale = getLocales()[0]?.languageCode === 'en' ? 'en' : 'pt-BR';

const strings: Record<StringKey, string> = locale === 'en' ? en : ptBR;

/** Translate `key`, filling `{param}` placeholders. */
export function t(key: StringKey, params?: Record<string, string | number>): string {
  const s = strings[key];
  return params ? s.replace(/\{(\w+)\}/g, (m, p: string) => (p in params ? String(params[p]) : m)) : s;
}
