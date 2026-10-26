/**
 * Módulo de integración con la Santa Biblia Reina Valera 1960 (RVR1960)
 *
 * Características:
 * - Soporte universal para Web y Móvil (CORS habilitado al 100%).
 * - Búsqueda insensible a acentos ('josue', 'Josué', 'jeremias', '1 juan').
 * - Separador flexible ('josue 1 9', 'josue 1:9', 'josue 1.9').
 * - Rangos de versículos completos ('1 juan 4 18-19', 'josue 1 9-10', '1 corintios 13 4-8').
 * - Motor híbrido: Consulta inmediata con snapshot RVR1960 con CORS libre y fallback a API secundaria.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const RVR1960_JSON_URL = 'https://mrk214.github.io/snapshots/es___spa___spa/RVR1960_vid_149.json';
const SECONDARY_API_URL = 'https://ajphchgh0i.execute-api.us-west-2.amazonaws.com/dev/api';
const CACHE_STORAGE_KEY = '@planeador_pastoral_rvr1960_bible_v1';

export interface QuickBibleVerse {
  reference: string;
  text: string;
  translation: string;
}

// Catálogo de versículos populares para inserción instantánea
export const POPULAR_VERSES: QuickBibleVerse[] = [
  {
    reference: 'Filipenses 4:13',
    text: 'Todo lo puedo en Cristo que me fortalece.',
    translation: 'RVR1960',
  },
  {
    reference: 'Jeremías 29:11',
    text: 'Porque yo sé los pensamientos que tengo acerca de vosotros, dice Jehová, pensamientos de paz, y no de mal, para daros el fin que esperáis.',
    translation: 'RVR1960',
  },
  {
    reference: 'Salmos 23:1',
    text: 'Jehová es mi pastor; nada me faltará.',
    translation: 'RVR1960',
  },
  {
    reference: 'Isaías 40:31',
    text: 'Pero los que esperan a Jehová tendrán nuevas fuerzas; levantarán alas como las águilas; correrán, y no se cansarán; caminarán, y no se fatigarán.',
    translation: 'RVR1960',
  },
  {
    reference: 'Romanos 8:28',
    text: 'Y sabemos que a los que aman a Dios, todas las cosas les ayudan a bien, esto es, a los que conforme a su propósito son llamados.',
    translation: 'RVR1960',
  },
  {
    reference: 'Josué 1:9',
    text: 'Mira que te mando que te esfuerces y seas valiente; no temas ni desmayes, porque Jehová tu Dios estará contigo en dondequiera que vayas.',
    translation: 'RVR1960',
  },
  {
    reference: 'Juan 3:16',
    text: 'Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.',
    translation: 'RVR1960',
  },
  {
    reference: '1 Juan 4:18-19',
    text: '[18] En el amor no hay temor, sino que el perfecto amor echa fuera el temor; porque el temor lleva en sí castigo. De donde el que teme, no ha sido perfeccionado en el amor. [19] Nosotros le amamos a él, porque él nos amó primero.',
    translation: 'RVR1960',
  },
  {
    reference: 'Proverbios 3:5-6',
    text: 'Fíate de Jehová de todo tu corazón, y no te apoyes en tu propia prudencia. Reconócelo en todos tus caminos, y él enderezará tus veredas.',
    translation: 'RVR1960',
  },
  {
    reference: 'Salmos 91:1-2',
    text: 'El que habita al abrigo del Altísimo morará bajo la sombra del Omnipotente. Diré yo a Jehová: Esperanza mía, y castillo mío; mi Dios, en quien confiaré.',
    translation: 'RVR1960',
  },
  {
    reference: 'Mateo 11:28',
    text: 'Venid a mí todos los que estáis trabajados y cargados, y yo os haré descansar.',
    translation: 'RVR1960',
  },
];

/**
 * Normaliza cadenas de texto para búsqueda insensible a acentos, mayúsculas y espacios duplicados.
 */
export function normalizeText(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Nombres canónicos formales de los 66 libros de la Biblia en Español
export const BOOK_CANONICAL_NAMES: Record<string, string> = {
  GEN: 'Génesis',
  EXO: 'Éxodo',
  LEV: 'Levítico',
  NUM: 'Números',
  DEU: 'Deuteronomio',
  JOS: 'Josué',
  JDG: 'Jueces',
  RUT: 'Rut',
  '1SA': '1 Samuel',
  '2SA': '2 Samuel',
  '1KI': '1 Reyes',
  '2KI': '2 Reyes',
  '1CH': '1 Crónicas',
  '2CH': '2 Crónicas',
  EZR: 'Esdras',
  NEH: 'Nehemías',
  EST: 'Ester',
  JOB: 'Job',
  PSA: 'Salmos',
  PRO: 'Proverbios',
  ECC: 'Eclesiastés',
  SNG: 'Cantares',
  ISA: 'Isaías',
  JER: 'Jeremías',
  LAM: 'Lamentaciones',
  EZK: 'Ezequiel',
  DAN: 'Daniel',
  HOS: 'Oseas',
  JOL: 'Joel',
  AMO: 'Amós',
  OBA: 'Abdías',
  JON: 'Jonás',
  MIC: 'Miqueas',
  NAM: 'Nahúm',
  HAB: 'Habacuc',
  ZEP: 'Sofonías',
  HAG: 'Hageo',
  ZEC: 'Zacarías',
  MAL: 'Malaquías',
  MAT: 'Mateo',
  MRK: 'Marcos',
  LUK: 'Lucas',
  JHN: 'Juan',
  ACT: 'Hechos',
  ROM: 'Romanos',
  '1CO': '1 Corintios',
  '2CO': '2 Corintios',
  GAL: 'Gálatas',
  EPH: 'Efesios',
  PHP: 'Filipenses',
  COL: 'Colosenses',
  '1TH': '1 Tesalonicenses',
  '2TH': '2 Tesalonicenses',
  '1TI': '1 Timoteo',
  '2TI': '2 Timoteo',
  TIT: 'Tito',
  PHM: 'Filemón',
  HEB: 'Hebreos',
  JAS: 'Santiago',
  '1PE': '1 Pedro',
  '2PE': '2 Pedro',
  '1JN': '1 Juan',
  '2JN': '2 Juan',
  '3JN': '3 Juan',
  JUD: 'Judas',
  REV: 'Apocalipsis',
};

// Mapeo exhaustivo de variantes escritas (sin acentos) al código USFM
const BOOK_ALIAS_TO_USFM: Record<string, string> = {
  // Antiguo Testamento
  genesis: 'GEN', gen: 'GEN', gn: 'GEN',
  exodo: 'EXO', exo: 'EXO', ex: 'EXO',
  levitico: 'LEV', lev: 'LEV', lv: 'LEV',
  numeros: 'NUM', num: 'NUM', nm: 'NUM',
  deuteronomio: 'DEU', deut: 'DEU', dt: 'DEU',
  josue: 'JOS', jos: 'JOS',
  jueces: 'JDG', jue: 'JDG', jc: 'JDG',
  rut: 'RUT', rt: 'RUT',
  '1 samuel': '1SA', '1samuel': '1SA', '1 sam': '1SA', '1sam': '1SA',
  '2 samuel': '2SA', '2samuel': '2SA', '2 sam': '2SA', '2sam': '2SA',
  '1 reyes': '1KI', '1reyes': '1KI', '1 rey': '1KI', '1rey': '1KI',
  '2 reyes': '2KI', '2reyes': '2KI', '2 rey': '2KI', '2rey': '2KI',
  '1 cronicas': '1CH', '1cronicas': '1CH', '1 cr': '1CH', '1cr': '1CH',
  '2 cronicas': '2CH', '2cronicas': '2CH', '2 cr': '2CH', '2cr': '2CH',
  esdras: 'EZR', esd: 'EZR',
  nehemias: 'NEH', neh: 'NEH',
  ester: 'EST', est: 'EST',
  job: 'JOB',
  salmo: 'PSA', salmos: 'PSA', sal: 'PSA', slm: 'PSA', psalms: 'PSA', ps: 'PSA',
  proverbios: 'PRO', prov: 'PRO', prv: 'PRO',
  eclesiastes: 'ECC', ecl: 'ECC',
  cantares: 'SNG', 'cantar de los cantares': 'SNG', cant: 'SNG',
  isaias: 'ISA', isa: 'ISA', is: 'ISA',
  jeremias: 'JER', jer: 'JER',
  lamentaciones: 'LAM', lam: 'LAM',
  ezequiel: 'EZK', eze: 'EZK', ez: 'EZK',
  daniel: 'DAN', dan: 'DAN', dn: 'DAN',
  oseas: 'HOS', os: 'HOS',
  joel: 'JOL', jl: 'JOL',
  amos: 'AMO', am: 'AMO',
  abdias: 'OBA', abd: 'OBA',
  jonas: 'JON', jon: 'JON',
  miqueas: 'MIC', miq: 'MIC',
  nahum: 'NAM', nah: 'NAM',
  habacuc: 'HAB', hab: 'HAB',
  sofonias: 'ZEP', sof: 'ZEP',
  hageo: 'HAG', hag: 'HAG',
  zacarias: 'ZEC', zac: 'ZEC',
  malaquias: 'MAL', mal: 'MAL',

  // Nuevo Testamento
  mateo: 'MAT', mt: 'MAT', 's. mateo': 'MAT', 'san mateo': 'MAT', 's mateo': 'MAT',
  marcos: 'MRK', mc: 'MRK', mr: 'MRK', 's. marcos': 'MRK', 'san marcos': 'MRK', 's marcos': 'MRK',
  lucas: 'LUK', lc: 'LUK', 's. lucas': 'LUK', 'san lucas': 'LUK', 's lucas': 'LUK',
  juan: 'JHN', jn: 'JHN', 's. juan': 'JHN', 'san juan': 'JHN', 's juan': 'JHN', 's.juan': 'JHN',
  hechos: 'ACT', 'hechos de los apostoles': 'ACT', hch: 'ACT', act: 'ACT',
  romanos: 'ROM', rom: 'ROM', ro: 'ROM',
  '1 corintios': '1CO', '1corintios': '1CO', '1 cor': '1CO', '1cor': '1CO',
  '2 corintios': '2CO', '2corintios': '2CO', '2 cor': '2CO', '2cor': '2CO',
  galatas: 'GAL', gal: 'GAL',
  efesios: 'EPH', efe: 'EPH', eph: 'EPH',
  filipenses: 'PHP', fil: 'PHP', php: 'PHP',
  colosenses: 'COL', col: 'COL',
  '1 tesalonicenses': '1TH', '1tesalonicenses': '1TH', '1 tes': '1TH', '1tes': '1TH',
  '2 tesalonicenses': '2TH', '2tesalonicenses': '2TH', '2 tes': '2TH', '2tes': '2TH',
  '1 timoteo': '1TI', '1timoteo': '1TI', '1 tim': '1TI', '1tim': '1TI',
  '2 timoteo': '2TI', '2timoteo': '2TI', '2 tim': '2TI', '2tim': '2TI',
  tito: 'TIT', tit: 'TIT',
  filemon: 'PHM', flm: 'PHM',
  hebreos: 'HEB', heb: 'HEB',
  santiago: 'JAS', stg: 'JAS', sant: 'JAS',
  '1 pedro': '1PE', '1pedro': '1PE', '1 ped': '1PE', '1ped': '1PE', '1 pe': '1PE',
  '2 pedro': '2PE', '2pedro': '2PE', '2 ped': '2PE', '2ped': '2PE', '2 pe': '2PE',
  '1 juan': '1JN', '1juan': '1JN', '1 jn': '1JN', '1jn': '1JN',
  '2 juan': '2JN', '2juan': '2JN', '2 jn': '2JN', '2jn': '2JN',
  '3 juan': '3JN', '3juan': '3JN', '3 jn': '3JN', '3jn': '3JN',
  judas: 'JUD', jud: 'JUD', jd: 'JUD',
  apocalipsis: 'REV', apoc: 'REV', ap: 'REV', revelacion: 'REV', revelaciones: 'REV', rev: 'REV',
};

// Mapeo hacia la API secundaria de AWS por si se requiere
const USFM_TO_AWS_API: Record<string, string> = {
  GEN: 'Gen', EXO: 'Exod', LEV: 'Lev', NUM: 'Num', DEU: 'Deut',
  JOS: 'Josh', JDG: 'Judg', RUT: 'Ruth', '1SA': '1Sam', '2SA': '2Sam',
  '1KI': '1Kgs', '2KI': '2Kgs', '1CH': '1Chr', '2CH': '2Chr', EZR: 'Ezra',
  NEH: 'Neh', EST: 'Esth', JOB: 'Job', PSA: 'Ps', PRO: 'Prov',
  ECC: 'Eccl', SNG: 'Song', ISA: 'Isa', JER: 'Jer', LAM: 'Lam',
  EZK: 'Ezek', DAN: 'Dan', HOS: 'Hos', JOL: 'Joel', AMO: 'Amos',
  OBA: 'Obad', JON: 'Jonah', MIC: 'Mic', NAM: 'Nah', HAB: 'Hab',
  ZEP: 'Zeph', HAG: 'Hag', ZEC: 'Zech', MAL: 'Mal', MAT: 'Matt',
  MRK: 'Mark', LUK: 'Luke', JHN: 'John', ACT: 'Acts', ROM: 'Rom',
  '1CO': '1Cor', '2CO': '2Cor', GAL: 'Gal', EPH: 'Eph', PHP: 'Phil',
  COL: 'Col', '1TH': '1Thess', '2TH': '2Thess', '1TI': '1Tim', '2TI': '2Tim',
  TIT: 'Titus', PHM: 'Phlm', HEB: 'Heb', JAS: 'Jas', '1PE': '1Pet',
  '2PE': '2Pet', '1JN': '1John', '2JN': '2John', '3JN': '3John', JUD: 'Jude',
  REV: 'Rev',
};

// Caché en memoria para evitar re-descargas durante la sesión
let memoryBibleCache: any = null;
let downloadPromise: Promise<any> | null = null;

/**
 * Obtiene el objeto completo de la Biblia RVR1960.
 * Prioridad: Memoria -> AsyncStorage -> Descarga CDN con CORS abierto.
 */
async function loadBibleData(): Promise<any> {
  if (memoryBibleCache) {
    return memoryBibleCache;
  }

  if (downloadPromise) {
    return downloadPromise;
  }

  downloadPromise = (async () => {
    // 1. Intentar cargar desde almacenamiento local persistente
    try {
      const stored = await AsyncStorage.getItem(CACHE_STORAGE_KEY);
      if (stored) {
        memoryBibleCache = JSON.parse(stored);
        return memoryBibleCache;
      }
    } catch {
      // Ignorar fallo de storage y proceder a red
    }

    // 2. Descargar desde CDN de GitHub Pages (con CORS: * garantizado)
    try {
      const response = await fetch(RVR1960_JSON_URL);
      if (response.ok) {
        const json = await response.json();
        if (json && Array.isArray(json.books)) {
          memoryBibleCache = json;
          // Guardar en storage en background para no bloquear
          AsyncStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(json)).catch(() => {});
          return json;
        }
      }
    } catch (netErr) {
      console.warn('No se pudo descargar el snapshot de RVR1960:', netErr);
    }

    return null;
  })();

  try {
    const res = await downloadPromise;
    return res;
  } finally {
    downloadPromise = null;
  }
}

/**
 * Consulta la Santa Biblia en Español (Reina Valera 1960).
 *
 * Características:
 * - Insensible a acentos: 'josue 1 9', 'Josué 1:9', '1 juan 4 18-19'
 * - Separador libre: espacio, dos puntos (:), punto (.)
 * - Rangos de versículos: '1 juan 4 18-19', 'josue 1 9-10', 'salmos 23 1-3'
 */
export async function fetchBibleVerse(
  spanishRef: string
): Promise<{ reference: string; text: string; translation: string } | null> {
  const cleanRef = spanishRef.trim();
  if (!cleanRef) return null;

  // Analizar la referencia bíblica
  // Grupo 1: Nombre del libro (ej: "1 juan", "josue", "salmos", "filipenses")
  // Grupo 2: Capítulo (ej: "4", "1", "23")
  // Separador: dos puntos (:), punto (.), coma (,) o espacios
  // Grupo 3: Versículo inicial (ej: "18", "9", "1")
  // Grupo 4: Versículo final opcional tras guion (ej: "19", "10", "3")
  const match = cleanRef.match(/^(.+?)\s+(\d+)[:.,\s]+(\d+)(?:\s*[-–—]\s*(\d+))?\s*$/i);
  if (!match) {
    return null;
  }

  const rawBook = match[1];
  const chapterNum = parseInt(match[2], 10);
  let startVerse = parseInt(match[3], 10);
  let endVerse = match[4] ? parseInt(match[4], 10) : undefined;

  // Si escribieron el rango invertido (ej. 19-18), reordenar defensivamente
  if (endVerse !== undefined && endVerse < startVerse) {
    const temp = startVerse;
    startVerse = endVerse;
    endVerse = temp;
  }

  // Normalizar libro para búsqueda (elimina acentos, mayúsculas y espacios duplicados)
  const normalizedBookKey = normalizeText(rawBook);
  const usfm = BOOK_ALIAS_TO_USFM[normalizedBookKey];
  if (!usfm) {
    return null;
  }

  const canonicalBookName = BOOK_CANONICAL_NAMES[usfm] || rawBook.trim();
  const isRange = typeof endVerse === 'number' && endVerse > startVerse;
  const canonicalRef = isRange
    ? `${canonicalBookName} ${chapterNum}:${startVerse}-${endVerse}`
    : `${canonicalBookName} ${chapterNum}:${startVerse}`;

  // 1. Primero comprobar en catálogo rápido precargado (insensible a acentos y formato)
  const normTarget = normalizeText(canonicalRef).replace(/\s+/g, '');
  const foundFast = POPULAR_VERSES.find((v) => {
    const normV = normalizeText(v.reference).replace(/\s+/g, '');
    return normV === normTarget;
  });

  if (foundFast) {
    return foundFast;
  }

  // 2. Motor Principal: Snapshot RVR1960 con soporte CORS universal (Web, iOS, Android)
  try {
    const bibleData = await loadBibleData();
    if (bibleData && Array.isArray(bibleData.books)) {
      const book = bibleData.books.find((b: any) => b.usfm === usfm);
      if (book && Array.isArray(book.chapters)) {
        const chapter = book.chapters[chapterNum - 1];
        if (chapter && Array.isArray(chapter.items)) {
          const verseItems = chapter.items.filter((it: any) => it.type === 'verse');
          const maxVerse = isRange ? (endVerse as number) : startVerse;
          const matchedVerses: { num: number; text: string }[] = [];

          for (let v = startVerse; v <= maxVerse; v++) {
            const it = verseItems.find(
              (item: any) => Array.isArray(item.verse_numbers) && item.verse_numbers.includes(v)
            );
            if (it && Array.isArray(it.lines)) {
              const cleanedText = it.lines.join(' ').replace(/\s+/g, ' ').trim();
              matchedVerses.push({ num: v, text: cleanedText });
            }
          }

          if (matchedVerses.length > 0) {
            const cleanVerseText = matchedVerses
              .map((m) => (matchedVerses.length > 1 ? `[${m.num}] ` : '') + m.text)
              .join(' ');

            const lastNum = matchedVerses[matchedVerses.length - 1].num;
            const finalRef =
              matchedVerses.length > 1
                ? `${canonicalBookName} ${chapterNum}:${startVerse}-${lastNum}`
                : `${canonicalBookName} ${chapterNum}:${startVerse}`;

            return {
              reference: finalRef,
              text: cleanVerseText,
              translation: 'Reina Valera 1960',
            };
          }
        }
      }
    }
  } catch (err) {
    console.warn('Fallo en motor principal RVR1960, intentando fallback:', err);
  }

  // 3. Motor Fallback: API de AWS (funciona nativamente en iOS/Android)
  const apiId = USFM_TO_AWS_API[usfm];
  if (apiId) {
    try {
      const url = `${SECONDARY_API_URL}/books/spa-RVR1960:${apiId}/verses/${chapterNum}:${startVerse}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const targetVerses = isRange
            ? data.filter(
                (v: any) => v.verseNumber >= startVerse && v.verseNumber <= (endVerse as number)
              )
            : data.filter((v: any) => v.verseNumber === startVerse);

          const versesToUse = targetVerses.length > 0 ? targetVerses : [data[0]];

          const cleanVerseText = versesToUse
            .map((v: any) => {
              const rawText = v.cleanText || v.text || '';
              const cleaned = rawText
                .replace(/<[^>]*>/g, '')
                .replace(/^\d+\s*/, '')
                .replace(/\s+/g, ' ')
                .trim();
              return versesToUse.length > 1 ? `[${v.verseNumber}] ${cleaned}` : cleaned;
            })
            .join(' ');

          const actualEndVerse = isRange
            ? Math.min(endVerse as number, versesToUse[versesToUse.length - 1].verseNumber)
            : undefined;

          const actualRef =
            actualEndVerse && actualEndVerse !== startVerse
              ? `${canonicalBookName} ${chapterNum}:${startVerse}-${actualEndVerse}`
              : `${canonicalBookName} ${chapterNum}:${startVerse}`;

          return {
            reference: actualRef,
            text: cleanVerseText,
            translation: 'Reina Valera 1960',
          };
        }
      }
    } catch (fallbackErr) {
      console.warn('Fallback AWS API también falló:', fallbackErr);
    }
  }

  return null;
}
