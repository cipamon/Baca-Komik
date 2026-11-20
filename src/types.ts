export type BookStatus = 'published' | 'hidden';

export interface Book {
  id: string;
  code: string;
  title: string;
  author: string;
  category: string;
  year: number;
  isbn?: string;
  publisher?: string;
  language?: string;
  pages?: number;
  description?: string;
  pdfUrl: string;
  coverUrl?: string;
  status: BookStatus;
  recommended: boolean;
  readCount: number;
  downloadCount: number;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MemberAccount {
  id: string;
  username: string;
  fullName: string;
  active: boolean;
  favorites: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LibrarySettings {
  libraryName: string;
  tagline: string;
  itemsPerPage: number;
  allowGuestDownload: boolean;
  updatedBy?: string;
  updatedAt?: unknown;
}

export interface BookStatMap {
  [bookId: string]: {
    readCount: number;
    downloadCount: number;
    lastReadAt?: string;
  };
}

export interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  role: 'super_admin' | 'admin';
  createdAt?: unknown;
}

export interface ScrapePreviewItem {
  selected: boolean;
  title: string;
  author: string;
  category: string;
  year: number;
  pdfUrl: string;
  description: string;
}

export type PublicNavTab = 'home' | 'catalog' | 'categories' | 'favorites';

export type AdminTab =
  | 'dashboard'
  | 'books'
  | 'add-book'
  | 'categories'
  | 'hidden'
  | 'members'
  | 'import'
  | 'export'
  | 'stats'
  | 'settings';

export const PRIMARY_ADMIN_EMAIL = 'faniku2021@gmail.com';

export const DEFAULT_SETTINGS: LibrarySettings = {
  libraryName: 'Baca Komik',
  tagline: 'Perpustakaan komik dan literatur grafis digital berbahasa Indonesia.',
  itemsPerPage: 24,
  allowGuestDownload: true,
};

export const SEED_CATEGORIES: Array<{ id: string; name: string; slug: string; description: string }> = [
  {
    id: 'cat_komik_nusantara',
    name: 'Komik Nusantara',
    slug: 'komik-nusantara',
    description: 'Karya komik lokal Indonesia dengan latar budaya, legenda, dan kisah kontemporer.',
  },
  {
    id: 'cat_aksi_petualangan',
    name: 'Aksi & Petualangan',
    slug: 'aksi-petualangan',
    description: 'Komik penuh dinamika, ekspedisi, dan perjalanan heroik lintas dunia.',
  },
  {
    id: 'cat_fantasi_sihir',
    name: 'Fantasi & Sihir',
    slug: 'fantasi-sihir',
    description: 'Dunia imajinatif, mitologi, dan kisah sihir penuh keajaiban.',
  },
  {
    id: 'cat_misteri_detektif',
    name: 'Misteri & Detektif',
    slug: 'misteri-detektif',
    description: 'Teka-teki kriminal, investigasi arsip, dan alur penuh intrik.',
  },
  {
    id: 'cat_scifi_futuristik',
    name: 'Sci-Fi & Futuristik',
    slug: 'sci-fi-futuristik',
    description: 'Eksplorasi luar angkasa, kecerdasan buatan, dan peradaban masa depan.',
  },
  {
    id: 'cat_slice_of_life',
    name: 'Slice of Life',
    slug: 'slice-of-life',
    description: 'Cerita keseharian yang hangat, persahabatan, dan refleksi kehidupan.',
  },
  {
    id: 'cat_sejarah_budaya',
    name: 'Sejarah & Budaya',
    slug: 'sejarah-budaya',
    description: 'Adaptasi grafis sejarah Nusantara, arsitektur, dan warisan budaya.',
  },
  {
    id: 'cat_edukasi_sains',
    name: 'Edukasi & Sains',
    slug: 'edukasi-sains',
    description: 'Komik pengetahuan populer, sains terapan, dan literasi visual.',
  },
];

const DRIVE_FOLDER_PDFS: Array<{
  id: string;
  driveId: string;
  code: string;
  title: string;
  author: string;
  category: string;
  year: number;
  publisher: string;
  pages: number;
  language: string;
  recommended: boolean;
  readCount: number;
  downloadCount: number;
  description: string;
}> = [
  {
    id: 'bk_001',
    driveId: '16AXpaMGCwWAcJ-lBD5oEdq6epCzL6gSI',
    code: 'BK-001',
    title: 'Airlangga: The Unifier',
    author: 'Pustaka Nusantara',
    category: 'Sejarah & Budaya',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: true,
    readCount: 342,
    downloadCount: 118,
    description: 'Kisah visual Raja Airlangga dalam menyatukan kembali kerajaan Kahuripan di Jawa Timur pada abad ke-11.',
  },
  {
    id: 'bk_002',
    driveId: '1Im_RN5kx8bSgChnP6rf8xRWhhXHC_wxs',
    code: 'BK-002',
    title: 'Ambarawa: Heroic Triumph',
    author: 'Pustaka Nusantara',
    category: 'Aksi & Petualangan',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: true,
    readCount: 289,
    downloadCount: 95,
    description: 'Kronik heroik Pertempuran Palagan Ambarawa dan strategi Supit Urang di bawah pimpinan Jenderal Sudirman.',
  },
  {
    id: 'bk_003',
    driveId: '1hT89EiVHVV_Zs5NQ04tgfvN7U_RQhrK2',
    code: 'BK-003',
    title: 'Architects of a Nation',
    author: 'Pustaka Nusantara',
    category: 'Sejarah & Budaya',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: true,
    readCount: 274,
    downloadCount: 112,
    description: 'Para perancang gagasan kebangsaan Indonesia dari masa pergerakan hingga proklamasi kemerdekaan.',
  },
  {
    id: 'bk_004',
    driveId: '1Mbzm-ZjhUi2p46cTTGCiqI5gXw0TSYkp',
    code: 'BK-004',
    title: 'Banjar Saga: Bara Baja',
    author: 'Pustaka Nusantara',
    category: 'Komik Nusantara',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: true,
    readCount: 256,
    downloadCount: 84,
    description: 'Epik perlawanan dan ketangguhan masyarakat Kesultanan Banjar di Kalimantan Selatan.',
  },
  {
    id: 'bk_005',
    driveId: '1wAP8JH-zSqZcwNod2GgsABBYqjgGAltQ',
    code: 'BK-005',
    title: 'Banten: Glory and Betrayal',
    author: 'Pustaka Nusantara',
    category: 'Sejarah & Budaya',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: false,
    readCount: 231,
    downloadCount: 77,
    description: 'Kejayaan pelabuhan niaga Kesultanan Banten di bawah Sultan Ageng Tirtayasa serta dinamika politik istana.',
  },
  {
    id: 'bk_006',
    driveId: '1_Z5oHdCROR97woVaI8qLJlI1SWZbJVZN',
    code: 'BK-006',
    title: 'Birth of Indonesia',
    author: 'Pustaka Nusantara',
    category: 'Sejarah & Budaya',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: true,
    readCount: 298,
    downloadCount: 105,
    description: 'Narasi grafis lahirnya negara kesatuan Republik Indonesia dari peristiwa Rengasdengklok hingga 17 Agustus 1945.',
  },
  {
    id: 'bk_007',
    driveId: '1dxYKZZElXdlKs35MdUwadmYpFful8kL7',
    code: 'BK-007',
    title: "Borneo's First Kingdom",
    author: 'Pustaka Nusantara',
    category: 'Sejarah & Budaya',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: false,
    readCount: 194,
    downloadCount: 62,
    description: 'Jejak Kerajaan Kutai Martadipura di tepian Sungai Mahakam dan prasasti Yupa Raja Mulawarman.',
  },
  {
    id: 'bk_008',
    driveId: '1g9aZZ9MYRq79vKD2_NGzMNnIN6VUFByY',
    code: 'BK-008',
    title: 'Djong Jawa: Sea Giant',
    author: 'Pustaka Nusantara',
    category: 'Aksi & Petualangan',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: true,
    readCount: 312,
    downloadCount: 121,
    description: 'Kisah kapal raksasa Djong Jawa yang melintasi Samudra Hindia dan Laut Tiongkok Selatan pada masa kejayaan maritim.',
  },
  {
    id: 'bk_009',
    driveId: '1vx0yZ2H16mQ7U2N0sr8TJgQlvaT5ci_V',
    code: 'BK-009',
    title: 'Founding Indonesia',
    author: 'Pustaka Nusantara',
    category: 'Edukasi & Sains',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: false,
    readCount: 215,
    downloadCount: 69,
    description: 'Perjalanan perumusan dasar negara, sidang BPUPKI, dan konsensus para pendiri bangsa.',
  },
  {
    id: 'bk_010',
    driveId: '1PXmzc7MJlgwvNs75P-r6LnbQ8NXEB6G1',
    code: 'BK-010',
    title: 'Hindu-Buddhist Nusantara',
    author: 'Pustaka Nusantara',
    category: 'Sejarah & Budaya',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: false,
    readCount: 182,
    downloadCount: 54,
    description: 'Panorama peradaban, seni arsitektur candi, dan literasi era Hindu-Buddha di kepulauan Nusantara.',
  },
  {
    id: 'bk_011',
    driveId: '1enAQu4TmPh2t2SQnwqMvp0-nn1z9sPgW',
    code: 'BK-011',
    title: 'Madilog: Fire of Reason',
    author: 'Pustaka Nusantara',
    category: 'Edukasi & Sains',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: false,
    readCount: 208,
    downloadCount: 73,
    description: 'Pengenalan gagasan logika ilmiah dan pemikiran kritis Tan Malaka dalam balutan komik biografis.',
  },
  {
    id: 'bk_012',
    driveId: '1M6ica3HvB0FBRIzs-UeRWUbGkdwt_ND-',
    code: 'BK-012',
    title: 'Majapahit: Rise and Fall',
    author: 'Pustaka Nusantara',
    category: 'Komik Nusantara',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: false,
    readCount: 267,
    downloadCount: 91,
    description: 'Kebangkitan Majapahit di Trowulan, Sumpah Palapa Gajah Mada, hingga era akhir kemaharajaan.',
  },
  {
    id: 'bk_013',
    driveId: '1pa8dfB5OMzN0uozD7DscI9_kDjHa1oqn',
    code: 'BK-013',
    title: 'Nusantara Hindu-Buddhist Saga',
    author: 'Pustaka Nusantara',
    category: 'Sejarah & Budaya',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: false,
    readCount: 175,
    downloadCount: 58,
    description: 'Saga antar-kerajaan kuno Nusantara dari Tarumanegara, Mataram Kuno, hingga Singhasari.',
  },
  {
    id: 'bk_014',
    driveId: '1m89KQwdemkmw6diYz3gzhq72ilO-Mw7_',
    code: 'BK-014',
    title: 'Nusantara Islamic Saga',
    author: 'Pustaka Nusantara',
    category: 'Sejarah & Budaya',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: false,
    readCount: 199,
    downloadCount: 66,
    description: 'Perkembangan jaringan perdagangan dan kesultanan Islam di pesisir Sumatra, Jawa, dan Maluku.',
  },
  {
    id: 'bk_015',
    driveId: '14guwVVKlIxcsi22iBtcaudKA6COdoinn',
    code: 'BK-015',
    title: 'Nusantara Maritime Epic',
    author: 'Pustaka Nusantara',
    category: 'Aksi & Petualangan',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: false,
    readCount: 224,
    downloadCount: 82,
    description: 'Epik pelayaran lintas samudra para pelaut Nusantara dengan armada Pinisi dan jalur rempah.',
  },
  {
    id: 'bk_016',
    driveId: '1jLoReenk1PR-7wRu6bGtRca6H_5QE73e',
    code: 'BK-016',
    title: 'Prambanan Legend',
    author: 'Pustaka Nusantara',
    category: 'Fantasi & Sihir',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: false,
    readCount: 187,
    downloadCount: 74,
    description: 'Adaptasi grafis kisah legenda Candi Prambanan, Bandung Bondowoso, dan Roro Jonggrang.',
  },
  {
    id: 'bk_017',
    driveId: '1zVw2r_coa_b3dBT8ocOifLw3RQ566pn8',
    code: 'BK-017',
    title: 'Purnawarman the God King',
    author: 'Pustaka Nusantara',
    category: 'Sejarah & Budaya',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: false,
    readCount: 163,
    downloadCount: 51,
    description: 'Kisah Raja Purnawarman dari Tarumanegara dan pembangunan proyek irigasi Sungai Candrabaga.',
  },
  {
    id: 'bk_018',
    driveId: '1mHxe6-S1YUOlSa3x7uGSOy2LBbjYokxg',
    code: 'BK-018',
    title: 'Ramadan Through Time',
    author: 'Pustaka Nusantara',
    category: 'Slice of Life',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: false,
    readCount: 159,
    downloadCount: 49,
    description: 'Potret tradisi bulan suci Ramadan di berbagai daerah Nusantara dari masa ke masa.',
  },
  {
    id: 'bk_019',
    driveId: '1REsKqDA6_nE0zxUw8r48wtnx-kmJrL9h',
    code: 'BK-019',
    title: 'Samudera Pasai: The Eastern Pearl',
    author: 'Pustaka Nusantara',
    category: 'Sejarah & Budaya',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: false,
    readCount: 171,
    downloadCount: 57,
    description: 'Kejayaan Kesultanan Samudera Pasai di ujung utara Sumatra sebagai pusat niaga dan keilmuan.',
  },
  {
    id: 'bk_020',
    driveId: '1UG8khCYVMCupuoiYyROAkEFkAk7HMAyB',
    code: 'BK-020',
    title: 'Sang Arsitek Republik',
    author: 'Pustaka Nusantara',
    category: 'Komik Nusantara',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: false,
    readCount: 218,
    downloadCount: 79,
    description: 'Rekaman grafis pemikiran tata kota, seni, dan visi arsitektur modern Indonesia.',
  },
  {
    id: 'bk_021',
    driveId: '1xM0H0dPt7SR_utY2pl-iVIZsaMGKkIb9',
    code: 'BK-021',
    title: 'Semarang Five Day Battle',
    author: 'Pustaka Nusantara',
    category: 'Aksi & Petualangan',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: false,
    readCount: 168,
    downloadCount: 54,
    description: 'Kisah kepahlawanan Pertempuran Lima Hari di Semarang pada Oktober 1945.',
  },
  {
    id: 'bk_022',
    driveId: '1YU51pSoqcCRp5-lH_yIF6Iw-zd5bsaCV',
    code: 'BK-022',
    title: 'Srivijaya Maritime Might',
    author: 'Pustaka Nusantara',
    category: 'Sejarah & Budaya',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: false,
    readCount: 205,
    downloadCount: 71,
    description: 'Kekuatan maritim Kedatuan Sriwijaya yang menguasai jalur perdagangan Selat Malaka.',
  },
  {
    id: 'bk_023',
    driveId: '1jx1T-fcsws754OwFjANFjTBUNy4TNc9_',
    code: 'BK-023',
    title: 'Sunan Kudus Legacy',
    author: 'Pustaka Nusantara',
    category: 'Sejarah & Budaya',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: false,
    readCount: 152,
    downloadCount: 48,
    description: 'Warisan dakwah kultural dan arsitektur Menara Kudus yang memadukan tradisi Nusantara.',
  },
  {
    id: 'bk_024',
    driveId: '1I1OuN4Nu_OYWTmHzh-JXbFGRhEYJ5tG1',
    code: 'BK-024',
    title: 'Surabaya 1945',
    author: 'Pustaka Nusantara',
    category: 'Aksi & Petualangan',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: false,
    readCount: 249,
    downloadCount: 88,
    description: 'Semangat arek-arek Suroboyo mempertahankan kedaulatan bangsa pada peristiwa 10 November 1945.',
  },
  {
    id: 'bk_025',
    driveId: '1NpfaGPkrclRFI5s4Bj6hCDrdmSHHFYiB',
    code: 'BK-025',
    title: "Tan Malaka's Blueprint",
    author: 'Pustaka Nusantara',
    category: 'Edukasi & Sains',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: false,
    readCount: 174,
    downloadCount: 61,
    description: 'Rancangan gagasan republik merdeka dalam risalah Naar de Republiek Indonesia.',
  },
  {
    id: 'bk_026',
    driveId: '1i6sT7BeRmE99V-UT_EfCqNvKJhVZbtF3',
    code: 'BK-026',
    title: 'Tearing the Blue',
    author: 'Pustaka Nusantara',
    category: 'Komik Nusantara',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: false,
    readCount: 192,
    downloadCount: 65,
    description: 'Momen bersejarah insiden perobekan warna biru bendera di Hotel Yamato Surabaya.',
  },
  {
    id: 'bk_027',
    driveId: '1aplVrSU-4UZ5w1Lmz8sNqZE8k20_O0Dc',
    code: 'BK-027',
    title: 'The Aceh Saga',
    author: 'Pustaka Nusantara',
    category: 'Sejarah & Budaya',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: false,
    readCount: 185,
    downloadCount: 63,
    description: 'Ketangguhan Kesultanan Aceh Darussalam dan para pahlawan di ujung barat Nusantara.',
  },
  {
    id: 'bk_028',
    driveId: '1IlqfZsvk0JmbwJdpC3LdY-JLTjGCvyZo',
    code: 'BK-028',
    title: 'The Cursed Dynasty',
    author: 'Pustaka Nusantara',
    category: 'Misteri & Detektif',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: false,
    readCount: 164,
    downloadCount: 52,
    description: 'Drama intrik kekuasaan dan kisah keris Empu Gandring di balik sejarah Singhasari.',
  },
  {
    id: 'bk_029',
    driveId: '1LVlq6TsG7PL8kDeYk5M7QjUYBr5VWsuw',
    code: 'BK-029',
    title: 'The Honest Merchant',
    author: 'Pustaka Nusantara',
    category: 'Slice of Life',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: false,
    readCount: 141,
    downloadCount: 44,
    description: 'Kisah keteladanan dan integritas saudagar di jalur niaga pelabuhan kuno Nusantara.',
  },
  {
    id: 'bk_030',
    driveId: '1tNBDUAsL5vHkgL25zESRhtkFS6bunDzA',
    code: 'BK-030',
    title: 'The Isyana Dynasty',
    author: 'Pustaka Nusantara',
    category: 'Sejarah & Budaya',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: false,
    readCount: 136,
    downloadCount: 41,
    description: 'Perpindahan pusat kekuasaan Mataram ke Jawa Timur oleh Mpu Sindok pendiri Wangsa Isyana.',
  },
  {
    id: 'bk_031',
    driveId: '1o40SpM4kVzfzT4AwBeH8xh1y_akiqMEG',
    code: 'BK-031',
    title: 'The Justice of Queen Shima',
    author: 'Pustaka Nusantara',
    category: 'Sejarah & Budaya',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: false,
    readCount: 178,
    downloadCount: 59,
    description: 'Ketegasan hukum dan keadilan Ratu Shima memimpin Kerajaan Kalingga di pesisir utara Jawa.',
  },
  {
    id: 'bk_032',
    driveId: '1FSzm_ct3i-LJNGikuDSG33-W9sdNPsgI',
    code: 'BK-032',
    title: 'The Kediri Kingdom',
    author: 'Pustaka Nusantara',
    category: 'Sejarah & Budaya',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: false,
    readCount: 147,
    downloadCount: 46,
    description: 'Masa keemasan sastra kakawin dan ramalan Jayabaya pada era Kerajaan Panjalu-Kediri.',
  },
  {
    id: 'bk_033',
    driveId: '1e4RnnneQWV_H7O-GZFDtw2Y8o0Xpgc2a',
    code: 'BK-033',
    title: 'The Mataram Islam Saga',
    author: 'Pustaka Nusantara',
    category: 'Sejarah & Budaya',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: false,
    readCount: 166,
    downloadCount: 55,
    description: 'Kebesaran Kesultanan Mataram Islam di bawah Panembahan Senopati hingga Sultan Agung.',
  },
  {
    id: 'bk_034',
    driveId: '1EDL3O9A93BDjTsG-nlSjugJdKaoSS4SZ',
    code: 'BK-034',
    title: 'The Mataram Saga',
    author: 'Pustaka Nusantara',
    category: 'Sejarah & Budaya',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: false,
    readCount: 158,
    downloadCount: 50,
    description: 'Dinamika Wangsa Sanjaya dan Syailendra membangun mahakarya Borobudur dan Prambanan.',
  },
  {
    id: 'bk_035',
    driveId: '15qPlOtYoTldw4d8ppI9QBbP1445QHxH0',
    code: 'BK-035',
    title: 'The Perlak Sultanate',
    author: 'Pustaka Nusantara',
    category: 'Sejarah & Budaya',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: false,
    readCount: 139,
    downloadCount: 43,
    description: 'Sejarah Kesultanan Peureulak sebagai salah satu pelabuhan niaga tertua di Aceh.',
  },
  {
    id: 'bk_036',
    driveId: '16pZEiMy1O5K9SfnNHyt8UDOOEK3T93Ew',
    code: 'BK-036',
    title: 'Unmasking Salakanagara',
    author: 'Pustaka Nusantara',
    category: 'Misteri & Detektif',
    year: 2026,
    publisher: 'Koleksi Google Drive',
    pages: 32,
    language: 'Indonesia / Inggris',
    recommended: false,
    readCount: 184,
    downloadCount: 62,
    description: 'Penelusuran naskah dan jejak arkeologis kerajaan kuno Salakanagara di tanah Sunda.',
  },
];

export const SEED_BOOKS: Book[] = DRIVE_FOLDER_PDFS.map((item) => ({
  id: item.id,
  code: item.code,
  title: item.title,
  author: item.author,
  category: item.category,
  year: item.year,
  publisher: item.publisher,
  pages: item.pages,
  language: item.language,
  recommended: item.recommended,
  readCount: item.readCount,
  downloadCount: item.downloadCount,
  description: item.description,
  pdfUrl: `https://drive.google.com/file/d/${item.driveId}/view`,
  coverUrl: '',
  status: 'published',
  createdBy: 'system',
}));
