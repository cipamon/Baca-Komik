export interface SamplePdfMeta {
  id: string;
  code: string;
  title: string;
  author: string;
  category: string;
  year: number;
  publisher?: string;
  accent?: string;
}

function escapePdfText(input: string): string {
  return input
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length <= maxChars) {
      current = (current + ' ' + word).trim();
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

function hexToRgbFraction(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [0.06, 0.14, 0.26];
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [
    Number.isFinite(r) ? Number(r.toFixed(3)) : 0.06,
    Number.isFinite(g) ? Number(g.toFixed(3)) : 0.14,
    Number.isFinite(b) ? Number(b.toFixed(3)) : 0.26,
  ];
}

const PALETTES: [string, string][] = [
  ['#0F2342', '#0284C7'],
  ['#1E293B', '#0EA5E9'],
  ['#172554', '#38BDF8'],
  ['#0C4A6E', '#0369A1'],
  ['#1E1B4B', '#2563EB'],
  ['#134E4A', '#0D9488'],
  ['#3B0764', '#7C3AED'],
  ['#450A0A', '#DC2626'],
];

function pickPalette(seed: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PALETTES[hash % PALETTES.length];
}

export function generateSampleComicPdf(meta: SamplePdfMeta): Buffer {
  const [primaryHex, accentHex] = pickPalette(meta.id + meta.title);
  const [pr, pg, pb] = hexToRgbFraction(meta.accent || primaryHex);
  const [ar, ag, ab] = hexToRgbFraction(accentHex);

  const pageWidth = 595;
  const pageHeight = 842;

  const titleLines = wrapText(meta.title, 22).slice(0, 3);
  const safeAuthor = escapePdfText(meta.author || 'Penulis Nusantara');
  const safeCategory = escapePdfText(meta.category || 'Komik');
  const safeCode = escapePdfText(meta.code || 'BK-001');
  const safePublisher = escapePdfText(meta.publisher || 'Pustaka Baca Komik');
  const safeYear = String(meta.year || 2026);

  // Page 1: Illustrated Editorial Comic Cover
  const coverCommands: string[] = [
    // Deep cover background
    `${pr} ${pg} ${pb} rg`,
    `0 0 ${pageWidth} ${pageHeight} re f`,
    // Subtle top accent stripe
    `${ar} ${ag} ${ab} rg`,
    `0 ${pageHeight - 28} ${pageWidth} 28 re f`,
    // Framed geometric comic artwork window
    `0.97 0.98 0.99 rg`,
    `48 270 ${pageWidth - 96} 340 re f`,
    // Inner comic panels inside cover art box
    `${ar} ${ag} ${ab} rg`,
    `64 430 220 162 re f`,
    `0.09 0.16 0.29 rg`,
    `298 430 233 162 re f`,
    `0.92 0.95 0.98 rg`,
    `64 288 467 128 re f`,
    // Comic panel geometric accents (rising sun / horizon circle & architectural lines)
    `1 1 1 rg`,
    `174 510 42 42 re f`,
    `${ar} ${ag} ${ab} rg`,
    `100 315 160 14 re f`,
    `0.06 0.14 0.26 rg`,
    `100 340 280 10 re f`,
    `100 362 210 10 re f`,
    // Header label
    `BT`,
    `/F2 11 Tf`,
    `0.85 0.92 0.98 rg`,
    `48 784 Td`,
    `(${safeCode}  /  ${safeCategory.toUpperCase()}  /  ${safeYear}) Tj`,
    `ET`,
    // Brand label at top right
    `BT`,
    `/F2 11 Tf`,
    `1 1 1 rg`,
    `440 784 Td`,
    `(BACA KOMIK) Tj`,
    `ET`,
  ];

  // Cover Title lines
  let titleY = 720;
  for (const line of titleLines) {
    coverCommands.push(
      `BT`,
      `/F1 30 Tf`,
      `1 1 1 rg`,
      `48 ${titleY} Td`,
      `(${escapePdfText(line)}) Tj`,
      `ET`
    );
    titleY -= 38;
  }

  // Cover footer credits
  coverCommands.push(
    `0.25 0.38 0.55 rg`,
    `48 210 ${pageWidth - 96} 1.5 re f`,
    `BT`,
    `/F2 15 Tf`,
    `1 1 1 rg`,
    `48 175 Td`,
    `(Karya: ${safeAuthor}) Tj`,
    `ET`,
    `BT`,
    `/F2 11 Tf`,
    `0.78 0.86 0.95 rg`,
    `48 148 Td`,
    `(Penerbit: ${safePublisher}  |  Edisi Digital Resmi) Tj`,
    `ET`,
    `BT`,
    `/F2 10 Tf`,
    `0.65 0.76 0.88 rg`,
    `48 64 Td`,
    `(Koleksi Perpustakaan Digital Baca Komik  -  Halaman Sampul) Tj`,
    `ET`
  );

  const pageStreams: string[] = [coverCommands.join('\n')];

  // Pages 2 - 5: Comic Panel Story Pages
  const storyChapters = [
    {
      chapter: 'BAB 01: AWAL PERJALANAN',
      panels: [
        `Di sudut kota yang tenang, arsip kisah ${meta.title} mulai terbuka.`,
        `Langkah pertama selalu dimulai dari rasa ingin tahu yang tulus.`,
        `Setiap halaman menyimpan jejak gambar, dialog, dan emosi yang hidup.`,
      ],
    },
    {
      chapter: 'BAB 02: PERTEMUAN DI STASIUN LAMA',
      panels: [
        `Angin senja berhembus melewati peron tua saat buku catatan ditemukan.`,
        `Garis tinta hitam menegaskan bayangan masa lalu dan harapan esok.`,
        `Kini saatnya menelusuri misteri yang tertulis di balik sampul biru.`,
      ],
    },
    {
      chapter: 'BAB 03: LANGKAH MENUJU PUNCAK',
      panels: [
        `Meski jalan terjal menghadang, tekad tokoh utama tak pernah goyah.`,
        `Sahabat sejati hadir membawa cahaya di tengah kabut pegunungan.`,
        `Keberanian tumbuh dari pilihan kecil yang dilakukan setiap hari.`,
      ],
    },
    {
      chapter: 'BAB 04: CATATAN PENUTUP',
      panels: [
        `Lembar akhir edisi pratinjau ${meta.title} telah dicapai.`,
        `Terima kasih telah membaca melalui Perpustakaan Digital Baca Komik.`,
        `Simpan ke daftar favorit untuk melanjutkan koleksi seri berikutnya.`,
      ],
    },
  ];

  storyChapters.forEach((story, idx) => {
    const pageNum = idx + 2;
    const cmds: string[] = [
      // Paper background
      `0.99 0.99 0.98 rg`,
      `0 0 ${pageWidth} ${pageHeight} re f`,
      // Top header rule
      `${pr} ${pg} ${pb} rg`,
      `42 790 ${pageWidth - 84} 2 re f`,
      `BT`,
      `/F2 10 Tf`,
      `0.35 0.42 0.52 rg`,
      `42 802 Td`,
      `(${escapePdfText(meta.title)}  -  ${escapePdfText(story.chapter)}) Tj`,
      `ET`,
      `BT`,
      `/F2 10 Tf`,
      `0.35 0.42 0.52 rg`,
      `510 802 Td`,
      `(Hal. ${pageNum}) Tj`,
      `ET`,
    ];

    // 3 Comic Panels stacked vertically with clean ink borders & geometric scene illustration
    const panelSpecs = [
      { y: 555, h: 210, tint: [0.95, 0.97, 1.0] },
      { y: 315, h: 215, tint: [0.97, 0.98, 0.99] },
      { y: 75, h: 215, tint: [0.94, 0.96, 0.99] },
    ];

    panelSpecs.forEach((p, pIdx) => {
      // Panel fill
      cmds.push(`${p.tint[0]} ${p.tint[1]} ${p.tint[2]} rg`);
      cmds.push(`42 ${p.y} ${pageWidth - 84} ${p.h} re f`);
      // Ink border
      cmds.push(`0.08 0.14 0.24 RG 1.8 w`);
      cmds.push(`42 ${p.y} ${pageWidth - 84} ${p.h} re S`);
      // Decorative comic illustration block on right side of panel
      cmds.push(`${ar} ${ag} ${ab} rg`);
      cmds.push(`${pageWidth - 195} ${p.y + 24} 132 ${p.h - 48} re f`);
      cmds.push(`${pr} ${pg} ${pb} rg`);
      cmds.push(`${pageWidth - 175} ${p.y + 44} 92 ${p.h - 88} re f`);
      // Panel speech/caption box
      cmds.push(`1 1 1 rg`);
      cmds.push(`58 ${p.y + p.h - 92} 310 70 re f`);
      cmds.push(`0.08 0.14 0.24 RG 1 w`);
      cmds.push(`58 ${p.y + p.h - 92} 310 70 re S`);

      const lines = wrapText(story.panels[pIdx], 42).slice(0, 3);
      let ty = p.y + p.h - 44;
      for (const ln of lines) {
        cmds.push(
          `BT`,
          `/F2 11 Tf`,
          `0.08 0.12 0.20 rg`,
          `70 ${ty} Td`,
          `(${escapePdfText(ln)}) Tj`,
          `ET`
        );
        ty -= 16;
      }

      // Panel number stamp
      cmds.push(
        `BT`,
        `/F1 9 Tf`,
        `0.42 0.48 0.58 rg`,
        `58 ${p.y + 18} Td`,
        `(PANEL ${pageNum}.${pIdx + 1}) Tj`,
        `ET`
      );
    });

    pageStreams.push(cmds.join('\n'));
  });

  // Assemble PDF 1.4 objects
  // Object 1: Catalog
  // Object 2: Pages
  // Object 3: Font F1 (Helvetica-Bold)
  // Object 4: Font F2 (Helvetica)
  // Objects 5..: Page + Content pairs
  const objects: string[] = [];
  const pageObjNums: number[] = [];

  // Placeholder slots 1..4
  objects.push(''); // 1: Catalog
  objects.push(''); // 2: Pages
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'); // 3
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'); // 4

  let nextObjNum = 5;
  for (const streamContent of pageStreams) {
    const pageObjNum = nextObjNum++;
    const contentObjNum = nextObjNum++;
    pageObjNums.push(pageObjNum);

    const streamLen = Buffer.byteLength(streamContent, 'latin1');
    objects[pageObjNum - 1] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjNum} 0 R >>`;
    objects[contentObjNum - 1] =
      `<< /Length ${streamLen} >>\nstream\n${streamContent}\nendstream`;
  }

  objects[0] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objects[1] = `<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageObjNums.length} >>`;

  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets: number[] = [0];

  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefStart = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += `0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}
