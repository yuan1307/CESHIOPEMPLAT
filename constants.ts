
import { Teacher, TaskCategory, FeatureFlags, ActionType } from './types';

// Raw data provided in prompt
const RAW_TEACHERS = `Abhishek Singh,数学,abhishek.singh-biph@basischina.com;Adam Harris Rovin,社会学科、AE,adam.rovin-biph@basischina.com;Anwar Satef,实验学科,anwar.satef-biph@basischina.com;Anthony Elder Jr,实验学科,anthony.elder-biph@basischina.com;Aoife Michelle Quigley,实验学科、ICT&CS、俱乐部,aoife.quigley-biph@basischina.com;Bige Sozen Kilic,实验学科, bige.kilic-biph@basischina.com;Brita Meaghan Baranieski,英语、其他选修课,brita.baranieski-biph@basischina.com;Brent Robert Kilback,实验学科,brent.kilback-biph@basischina.com;Brian Jason Horn,实验学科,brian.horn-biph@basischina.com;Campbell Fraser Chien Leong Wang,英语、ICT&CS、其他,campbell.wang-biph@basischina.com;Carrie Ann Jacquin,大学、AE,carrie.jacquin-biph@basischina.com;Cherisse Bernadine Small,英语、数学、跨学科、俱乐部、其他,cherisse.robinson-biph@basischina.com;Christian Alan Lygo,英语、俱乐部,christian.lygo-biph@basischina.com;Cody Ryan Kennedy,数学,cody.kennedy-biph@basischina.com;Curtis Alan Westbay,其他,curtis.westbay-biph@basischina.com;David Elliot Phillips,体育,david.phillips-biph@basischina.com;David Scott Nicholls,社会学科,david.nicholls-biph@basischina.com;Diego Guedes De Melo Considera,体育、其他选修课,diego.considera-biph@basischina.com;Dmytro Mishchenko,实验学科、俱乐部、AE,dima.mishchenko-biph@basischina.com;Doris Kimberley Sander,实验学科、俱乐部,doris.sander-biph@basischina.com;Dylan Nathaniel Robinson,英语、实验学科、俱乐部,dylan.robinson-biph@basischina.com;Erik Warren Johnson,实验学科,erik.johnson-biph@basischina.com;Evan James Wise,英语,evan.wise-biph@basischina.com;Garrison Fletcher Tubbs,艺术、其他选修课、俱乐部、AE,garrison.tubbs-biph@basischina.com;Gheorghe-Viorel Ailincai,社会学科、其他选修课、俱乐部,gheorghe.ailincai-biph@basischina.com;Gerardo Zepeda Diaz,大学、俱乐部、AE,gerardo.zepeda-biph@basischina.com;Graham Gilbert Gisselquist,实验学科、AE,graham.gisselquist-biph@basischina.com;Gregory Alan Gilbert,数学,gregory.gilbert-biph@basischina.com;Hunter Allen Mueller,俱乐部、其他,hunter.mueller-biph@basischina.com;Ian Andrew Ratcliffe,艺术、其他选修课、俱乐部、AE,ian.ratcliffe-biph@basischina.com;Iain Gordon Mcclinton,大学、俱乐部、其他,iain.mcclinton-biph@basischina.com;Inge Rix,实验学科,inge.rix-biph@basischina.com;Jacobus Cornelius Van Schalkwyk,数学,corne.vanschalkwyk-biph@basischina.com;Jaime Lynn Pindur,大学、俱乐部、AE,jaime.pindur-biph@basischina.com;Jenaya Nelmarie Wade-Fray,其他,jenaya.wade-fray-biph@basischina.com;Jordi Adan Navarrette,数学、其他选修课、AE,jordi.navarrette-biph@basischina.com;Joseph Edward Lotus,实验学科、其他选修课、俱乐部,joseph.lotus-biph@basischina.com;Joseph Edward Myer,数学,joseph.myer-biph@basischina.com;Jonathan Michael Beeson,大学、AE,jonathan.beeson-biph@basischina.com;Kaijun Michelle Chua,数学,michelle.chua-biph@basischina.com;Kaijuin Michelle Chua,数学,michelle.chua-biph@basischina.com;Kian David Mehrabi,俱乐部、其他,kian.mehrabi-biph@basischina.com;Kevin George Watts,实验学科,kevin.watts-biph@basischina.com;Kevton Magnus Foster,社会学科、AE,kevton.foster-biph@basischina.com;Koorosh Amirmonazah,实验学科、俱乐部,koorosh.amirmonazah-biph@basischina.com;Krupali Hemant Parekh,实验学科,kimmy.singh-biph@basischina.com;Kelsey Han,英语、数学、中文、社会学科、实验学科、艺术、体育、ICT&CS、演讲与辩论、AE,kelsey.han-biph@basischina.com;Liana Jane Anthony,艺术、其他选修课、俱乐部、AE,liana.anthony-biph@basischina.com;Leslie Ann Greiner,艺术、其他选修课、俱乐部,leslie.greiner-biph@basischina.com;Lorena Moore Craighead,英语、俱乐部,lorena.craighead-biph@basischina.com;Madalina Ailincai,数学,madalina.ailincai-biph@basischina.com;Maria Vasilaki,体育、其他选修课、俱乐部,maria.vasilaki-biph@basischina.com;Mark Boyd Earl Propp,实验学科、其他选修课、俱乐部,mark.propp-biph@basischina.com;Mark Lee Wilkerson,英语、俱乐部、演讲与辩论,mark.wilkerson-biph@basischina.com;Matthew James Boswell,英语、ICT&CS,matt.boswell-biph@basischina.com;Meagan Nomicos,英语、AE,meagan.nomicos-biph@basischina.com;Mehmet Kilic,实验学科, mehmet.kilic-biph@basischina.com;Michael Anthony Ehlers,艺术、其他选修课、ICT&CS、俱乐部,michael.ehlers-biph@basischina.com;Michael Belkin,社会学科、AE,michael.ehlers-biph@basischina.com;Mitchell Anthony Benjamin,实验学科,mitchell.benjamin-biph@basischina.com;Mirek Zhao,其他,mirek.zhao-biph@basischina.com;Olivia Wan,英语、数学、中文、体育、跨学科、ICT&CS、俱乐部、其他,olivia.wan-biph@basischina.com;Paige Alicyn Cooksey,英语、AE,paige.cooksey-biph@basischina.com;Rebekah Ruth Spoelman,英语、数学、中文、社会学科、其他,rebekah.spoelman-biph@basischina.com;Richard Johann Eduard Rix,社会学科、AE,richard.rix-biph@basischina.com;Richard Joseph Vigilante Jr,数学,richard.vigilante-biph@basischina.com;Robert Lee March,社会学科、俱乐部、AE, robert.march-biph@basischina.com;Rodica-Mira-Andreea Ocheseanu,艺术、其他选修课、俱乐部,rodica.ocheseanu-biph@basischina.com;Ronny Balboa,数学,ronny.balboa-biph@basischina.com;Randi Eileen Burdette,英语,randi.burdette-biph@basischina.com;Roszen Van Schalkwyk,社会学科、AE,jessica.vanschalkwyk-biph@basischina.com;Samuel Joseph Barnett,英语、社会学科、俱乐部,sam.barnett-biph@basischina.com;Sandra Marcela Romero,其他选修课、AE,sandra.romero-biph@basischina.com;Samantha Chen,英语、数学、中文、社会学科、实验学科、艺术、体育、ICT&CS、俱乐部、演讲与辩论、AE,samantha.chen-biph@basischina.com;Shazaib Ramzan Nauman,数学、AE,shazaib.nauman-biph@basischina.com;Sylvia Li,英语、数学、中文、艺术、体育、跨学科、ICT&CS、其他,sylvia.li-biph@basischina.com;Sydney Orlando Charles,体育、其他选修课,sydney.charles-biph@basischina.com;Stelios Stilpon Potamitis,英语、俱乐部、演讲与辩论、AE,stelios.potamitis-biph@basischina.com;Stephanie Xiao,实验学科,stephanie.xiao-biph@basischina.com;Teifion Jonathan Elwy Jones,艺术,tei.jones-biph@basischina.com;Thomas Edward Davis,社会学科、其他选修课、AE,thomas.davis-biph@basischina.com;Thomas Ryan Harper,社会学科、俱乐部、AE,thomas.harper-biph@basischina.com;Tyler Adam Duling,数学、ICT&CS、其他,tyler.duling-biph@basischina.com;Ulrike S Szalay,大学、俱乐部、AE,ulrike.szalay-biph@basischina.com;Victoria Anne Litchfield,艺术、其他选修课、AE,victoria.litchfield-biph@basischina.com;Victoria Elizabeth Wilke,英语、俱乐部、AE,victoria.wilke-biph@basischina.com;Waleid Ahmad Hafiz Hassan,数学,waleid.hassan-biph@basischina.com;Jeffrey Orland Sunquist,实验学科、AE,jeffrey.sunquist-biph@basischina.com;Ashlee Lv,中文、俱乐部,AE,ashlee.lv-biph@basischina.com;Colleen Zhang,跨学科,colleen.zhang-biph@basischina.com;Ella Chen,英语、中文、艺术、跨学科、ICT&CS,ella.chen-biph@basischina.com;Eva Yu,中文、俱乐部,eva.yu-biph@basischina.com;Hannah Zhao,中文、AE,hannah.zhao-biph@basischina.com;Jessica Van Schalkwyk,社会学科、AE,jessica.vanschalkwyk-biph@basischina.com;Kate Chen,英语、数学、中文、社会学科、实验学科、艺术、俱乐部、其他,kate.chen-biph@basischina.com;Mary Wang,中文、俱乐部,mary.wang-biph@basischina.com;Michelle Chua,数学,michelle.chua-biph@basischina.com;Candice Shen,中文、俱乐部,AE,candice.shen-biph@basischina.com;Chloe Shan,中文,chloe.shan-biph@basischina.com;Daisy Duan,其他,daisy.duan-biph@basischina.com;Amber Pan,俱乐部、其他,amber.pan-biph@basischina.com;Jane Guo,中文、俱乐部,jane.guo-biph@basischina.com;Victoria Sun,中文、俱乐部,victoria.sun-biph@basischina.com;`;

export const DEFAULT_TEACHERS: Teacher[] = RAW_TEACHERS.split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0)
  .map((s, idx) => {
    const parts = s.split(',');
    return {
      id: `t-${idx}`,
      name: parts[0]?.trim() || 'Unknown',
      subject: parts[1]?.trim() || 'General',
      email: parts[2]?.trim() || 'no-email',
    };
  });

export const ADMIN_ID = "14548";
export const SUPER_ADMIN_ID_2 = "Admin";

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export const DEFAULT_SUBJECTS = [
  "Math", "English", "Physics", "Chemistry", "Biology", 
  "History", "Geography", "Art", "Music", "PE", 
  "Computer Science", "Economics", "Chinese", "Calculus"
];

export const TASK_CATEGORIES: TaskCategory[] = [
  "Test", "Quiz", "Project", "Homework", "Presentation", "Personal", "Others"
];

export const GRADE_LEVELS = [
    'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'
];

export const DEFAULT_PASSWORD = "BASIS2025!";

export const DEFAULT_FLAGS: FeatureFlags = {
  enableCommunity: true,
  enableGPA: true,
  enableCalendar: true,
  autoApprovePosts: false,
  autoApproveRequests: false,
  enableAIImport: true,
  enableAIContentCheck: true,
  enableTeacherAI: true,
  enableAITutor: true,
  enableBriefing: true,
  enableTickets: true,
  isSystemLockdown: false
};

export const VISIBLE_ACTION_TYPES: ActionType[] = [
  'APPROVE_POST', 
  'BAN_USER', 
  'BROADCAST_TASK', 
  'CHANGE_PASSWORD', 
  'CHANGE_ROLE', 
  'COMMUNITY_EDIT', 
  'CREATE_POST', 
  'CREATE_TEACHER_ACC', 
  'DATABASE_EDIT', 
  'DELETE_USER', 
  'EDIT_ASSESSMENT_CALENDAR',
  'EDIT_EVENT_CALENDAR',
  'EDIT_SUBJECT_DATABASE', 
  'EDIT_TEACHER_DATABASE', 
  'FEATURE_TOGGLE', 
  'LOGIN', 
  'REJECT_POST', 
  'SEND_WARNING', 
  'UNBAN_USER', 
  'UPDATE_USER_NAME', 
  'WARNING',
  'SYSTEM_LOCKDOWN',
  'SYSTEM_RESTORE'
];

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'es', label: 'Español' },
  { code: 'hi', label: 'हिन्दी' }
];

export const calculateGPA = (percent: number): { grade: string, point: number } => {
  if (percent >= 93) return { grade: 'A', point: 4.00 };
  if (percent >= 90) return { grade: 'A-', point: 3.67 };
  if (percent >= 87) return { grade: 'B+', point: 3.33 };
  if (percent >= 83) return { grade: 'B', point: 3.00 };
  if (percent >= 80) return { grade: 'B-', point: 2.67 };
  if (percent >= 77) return { grade: 'C+', point: 2.33 };
  if (percent >= 73) return { grade: 'C', point: 2.00 };
  if (percent >= 70) return { grade: 'C-', point: 1.67 };
  if (percent >= 67) return { grade: 'D+', point: 1.33 };
  if (percent >= 63) return { grade: 'D', point: 1.00 };
  if (percent >= 60) return { grade: 'D-', point: 0.67 };
  return { grade: 'F', point: 0.00 };
};

export const getSubjectColor = (subject: string): string => {
  if (!subject) return 'bg-white';
  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = subject.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  return `hsl(${h}, 70%, 93%)`; // Pastel background
};
