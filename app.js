const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const cron = require('node-cron');

// ============================================================
// 1. KONFIGURASI UTAMA
// ============================================================
const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbyTfC6i3p_kjUxdkIB9qJ52yasiq_w4aX73Qm3LoMSfQfzbQ_THdbZmU-hxg5UunauK/exec'; 

const ALLOWED_NUMBERS = [
    '6281288498869@c.us', 
    '6281264213364@c.us'
];

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "bot-keuangan-v3"
    }),
   // webVersionCache: {
   //     type: 'remote',
   //     remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
   // },
    puppeteer: {
        executablePath: '/usr/bin/chromium-browser',
        handleSIGINT: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--disable-notifications',
            '--disable-extensions',
            '--disable-background-timer-throttling',
            '--js-flags="--max-old-space-size=4096"' 
        ]
    }
});

// ============================================================
// 2. EVENT INITIALIZATION & CRON JOB
// ============================================================
client.on('qr', async (qr) => {
    // --- 1. SCRIPT EXISTING (TIDAK DIRUBAH): Tetap cetak barcode di CLI & Log Docker ---
    qrcode.generate(qr, { small: true });
    console.log('>>> SYSTEM: QR Code siap, silakan scan.');

    // --- 2. SCRIPT TAMBAHAN: Melempar copy barcode ke Telegram ---
    try {
        const teleToken = '8739728597:AAF4WP_y3HTOQofGRikinJs5xQMIN7ILXKY'; 
        const chatId = '5334126436'; 
        
        const qrImageUrl = `https://quickchart.io/qr?text=${encodeURIComponent(qr)}&size=400&margin=4`;
        
        await axios.get(`https://api.telegram.org/bot${teleToken}/sendPhoto`, {
            params: {
                chat_id: chatId,
                photo: qrImageUrl,
                caption: '🚨 *BOT KEUANGAN LOGOUT!* 🚨\n\nSegera buka WhatsApp di HP Anda, pilih _Tautkan Perangkat_, dan scan QR Code ini.\n\n_(QR akan otomatis dikirim ulang jika belum di-scan)_',
                parse_mode: 'Markdown'
            }
        });
        console.log('>>> SYSTEM: Copy Barcode berhasil dikirim ke Telegram.');
    } catch (err) {
        console.error('>>> SYSTEM: Gagal mengirim Barcode ke Telegram.', err.message);
    }
});

client.on('ready', () => {
    console.log('>>> SYSTEM: Bot Keuangan (Ultimate Style) Aktif & Gesit!');

    // --- FITUR: PENGINGAT & REKAP OTOMATIS (JAM 23:00) ---
    cron.schedule('0 0 23 * * *', async () => {
        try {
            const response = await axios.post(GOOGLE_SHEET_URL, { action: 'GET_REKAP' });
            const { masuk, keluar, saldo } = response.data;

            const autoMsg = [
                `🌙 *LAPORAN PENUTUP HARI INI*`,
                `━━━━━━━━━━━━━━━━━━━━`,
                `Halo! Berikut ringkasan saldo Anda hari ini:`,
                ``,
                `💰 Saldo Awal Hari Ini:`,
                `👉 *Rp ${masuk.toLocaleString('id-ID')}*`,
                ``,
                `💸 Belanja Hari Ini:`,
                `👉 *Rp ${keluar.toLocaleString('id-ID')}*`,
                `━━━━━━━━━━━━━━━━━━━━`,
                `✨ *SISA SALDO AKHIR:*`,
                `👉 *Rp ${saldo.toLocaleString('id-ID')}*`,
                `━━━━━━━━━━━━━━━━━━━━`,
                `💡 _Sudah dicatat semua? Yuk cek kembali sebelum istirahat!_`
            ].join('\n');

            for (const chatId of ALLOWED_NUMBERS) {
                await client.sendMessage(chatId, autoMsg);
            }
            console.log('>>> SYSTEM: Laporan otomatis jam 23:00 terkirim.');
        } catch (err) {
            console.error("Gagal mengirim rekap otomatis:", err.message);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Jakarta"
    });
});

client.on('disconnected', (reason) => {
    console.log('>>> SYSTEM: Bot terputus!', reason);
});

// ============================================================
// 3. LOGIKA UTAMA
// ============================================================
client.on('message', async (msg) => {
    try {
        const contact = await msg.getContact();
        const senderId = contact.id._serialized;
        if (!ALLOWED_NUMBERS.includes(senderId)) return;

        const input = msg.body.trim();
        const inputLower = input.toLowerCase();

        // --- FITUR: PING ---
        if (inputLower === 'ping' || inputLower === 'tes') {
            return msg.reply('✅ Bot Online & Siap Mencatat!');
        }

        // --- FITUR: STIKER MAKER ---
        if (msg.hasMedia && inputLower === '!stiker') {
            try {
                const media = await msg.downloadMedia();
                return client.sendMessage(msg.from, media, { 
                    sendMediaAsSticker: true,
                    stickerAuthor: 'Bot Keuangan',
                    stickerName: 'Sticker'
                });
            } catch (err) { return msg.reply('❌ Gagal membuat stiker.'); }
        }

        // --- FITUR: GRAFIK (ASYNC) ---
        if (inputLower === 'grafik' || inputLower === 'chart') {
            (async () => {
                try {
                    const response = await axios.post(GOOGLE_SHEET_URL, { action: 'GET_REKAP_BULAN' });
                    const { masuk, keluar } = response.data;
                    if (!masuk && !keluar) return msg.reply('📊 Data bulan ini masih kosong.');

                    const chartConfig = {
                        type: 'pie',
                        data: {
                            labels: [`Masuk`, `Keluar`],
                            datasets: [{
                                data: [masuk || 1, keluar || 1], 
                                backgroundColor: ['#2ecc71', '#e74c3c'],
                                borderWidth: 2
                            }]
                        },
                        options: {
                            plugins: {
                                legend: { position: 'bottom' },
                                datalabels: { color: '#fff', font: { size: 18, weight: 'bold' } }
                            }
                        }
                    };
                    const urlChart = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&width=500&height=500&backgroundColor=white`;
                    const imageRes = await axios.get(urlChart, { responseType: 'arraybuffer', timeout: 15000 });
                    const base64Image = Buffer.from(imageRes.data, 'binary').toString('base64');
                    const media = new MessageMedia('image/png', base64Image);
                    await client.sendMessage(msg.from, media, { caption: `📊 *GRAFIK BULAN INI*\n\n📥 Masuk: *Rp ${masuk.toLocaleString('id-ID')}*\n📤 Keluar: *Rp ${keluar.toLocaleString('id-ID')}*` });
                } catch (err) { console.error("Grafik Error:", err.message); }
            })();
            return;
        }

        // --- FITUR TAMBAHAN: REKAP BULAN SPESIFIK (Contoh: rekap bulan maret) ---
        const regexBulanSpesifik = /^rekap\s+bulan\s+([a-zA-Z]+)$/i;
        const matchBulanSpesifik = input.match(regexBulanSpesifik);
        if (matchBulanSpesifik) {
            try {
                const bulanReq = matchBulanSpesifik[1];
                const response = await axios.post(GOOGLE_SHEET_URL, { action: 'GET_REKAP_BULAN', reqMonth: bulanReq });
                
                if (response.data.is404) {
                    return msg.reply(`📭 Data untuk bulan *${bulanReq.toUpperCase()}* tidak ditemukan.`);
                }

                const { masuk, keluar, saldo } = response.data;
                const msgRekapSpesifik = [
                    `📊 *LAPORAN REKAP BULAN ${bulanReq.toUpperCase()}*`,
                    `━━━━━━━━━━━━━━━━━━━━`,
                    `📥 Total Masuk: *Rp ${masuk.toLocaleString('id-ID')}*`,
                    `📤 Total Keluar: *Rp ${keluar.toLocaleString('id-ID')}*`,
                    `━━━━━━━━━━━━━━━━━━━━`,
                    `💰 *SISA SALDO: Rp ${saldo.toLocaleString('id-ID')}*`,
                    `━━━━━━━━━━━━━━━━━━━━`
                ].join('\n');
                return msg.reply(msgRekapSpesifik);
            } catch (err) { 
                return msg.reply(`❌ Gagal mengambil data saldo untuk bulan ${matchBulanSpesifik[1]}.`); 
            }
        }

        // --- FITUR: REKAP (HARIAN VS BULANAN) ---
        if (inputLower === 'rekap' || inputLower === 'rekap bulan' || inputLower === 'rekap bulanan') {
            try {
                const isMonthly = inputLower.includes('bulan');
                const actionType = isMonthly ? 'GET_REKAP_BULAN' : 'GET_REKAP';
                const response = await axios.post(GOOGLE_SHEET_URL, { action: actionType });
                const { masuk, keluar, saldo } = response.data;
                
                let msgRekap = "";
                if (isMonthly) {
                    msgRekap = [
                        `📊 *LAPORAN REKAP BULANAN*`,
                        `━━━━━━━━━━━━━━━━━━━━`,
                        `📥 Total Masuk: *Rp ${masuk.toLocaleString('id-ID')}*`,
                        `📤 Total Keluar: *Rp ${keluar.toLocaleString('id-ID')}*`,
                        `━━━━━━━━━━━━━━━━━━━━`,
                        `💰 *SISA SALDO: Rp ${saldo.toLocaleString('id-ID')}*`,
                        `━━━━━━━━━━━━━━━━━━━━`
                    ].join('\n');
                } else {
                    msgRekap = [
                        `📊 *REKAP HARIAN (ROLLING BALANCE)*`,
                        `━━━━━━━━━━━━━━━━━━━━`,
                        `💰 Saldo Awal Hari Ini:`,
                        `👉 *Rp ${masuk.toLocaleString('id-ID')}*`,
                        ``,
                        `💸 Pengeluaran Hari Ini:`,
                        `👉 *Rp ${keluar.toLocaleString('id-ID')}*`,
                        `━━━━━━━━━━━━━━━━━━━━`,
                        `✨ *SISA SALDO SEKARANG:*`,
                        `👉 *Rp ${saldo.toLocaleString('id-ID')}*`,
                        `━━━━━━━━━━━━━━━━━━━━`
                    ].join('\n');
                }
                return msg.reply(msgRekap);
            } catch (err) { return msg.reply('❌ Gagal mengambil data saldo.'); }
        }

        // --- FITUR: HISTORY BY CATEGORY ---
        const regexCat = /^(?:history|riwayat)\s+([a-zA-Z\s]+?)(?:\s+(\d+|semua|all))?$/i;
        const matchCat = input.match(regexCat);
        if (matchCat && !['rekap', 'bulan'].includes(matchCat[1].toLowerCase().trim())) {
            try {
                const keyword = matchCat[1].trim();
                const limitInput = matchCat[2] ? matchCat[2].toLowerCase() : 'semua';
                const response = await axios.post(GOOGLE_SHEET_URL, { action: 'GET_HISTORY_CATEGORY', keyword: keyword, limitReq: limitInput });
                const { history, total, keyword: keyUpper } = response.data;
                if (!history || history.length === 0) return msg.reply(`📭 Tidak ada data untuk: *${keyword}*`);
                return msg.reply(`🐾 *RIWAYAT: ${keyUpper.toUpperCase()}*\n━━━━━━━━━━━━━━━━━━━━\n${history.map((item, i) => `${i + 1}. ${item}`).join('\n')}\n━━━━━━━━━━━━━━━━━━━━\n💰 *Total: Rp ${total.toLocaleString('id-ID')}*`);
            } catch (err) { return msg.reply('❌ Gagal mencari riwayat kategori.'); }
        }

        // --- FITUR: HISTORY LIMIT ---
        const regexHistory = /^(history|riwayat)(?:\s+(\d+|semua|all))?$/i;
        const matchHistory = input.match(regexHistory);
        if (matchHistory) {
            try {
                const limitInput = matchHistory[2] ? matchHistory[2].toLowerCase() : '5';
                const response = await axios.post(GOOGLE_SHEET_URL, { action: 'GET_HISTORY', limitReq: limitInput });
                const historyData = response.data.history;
                if (!historyData || historyData.length === 0) return msg.reply('📭 Belum ada transaksi.');
                return msg.reply(`📜 *${historyData.length} TRANSAKSI TERAKHIR*\n━━━━━━━━━━━━━━━━━━━━\n${historyData.map((item, i) => `${i + 1}. ${item}`).join('\n')}\n━━━━━━━━━━━━━━━━━━━━`);
            } catch (err) { return msg.reply('❌ Gagal mengambil riwayat.'); }
        }

        // --- FITUR: BATAL ---
        if (inputLower === 'batal') {
            try {
                await axios.post(GOOGLE_SHEET_URL, { action: 'DELETE_LAST' });
                return msg.reply('🗑️ *BERHASIL!* Baris terakhir telah dihapus.');
            } catch (err) { return msg.reply('❌ Gagal membatalkan catatan.'); }
        }

        // --- FITUR: MENU BANTUAN ---
        if (['help', 'menu', 'p'].includes(inputLower)) {
            return msg.reply(`💡 *MENU BOT KEUANGAN*\n━━━━━━━━━━━━━━━━━━━━\n1️⃣ *Catat:* Nama Harga [Metode] \n2️⃣ *Harian:* \`rekap\` \n3️⃣ *Bulanan:* \`rekap bulan\` \n4️⃣ *Cari:* \`History Anabul\` \n5️⃣ *History:* \`History 10\` \n6️⃣ *Visual:* \`Grafik\` \n7️⃣ *Batal:* \`Batal\``);
        }

        // --- LOGIKA CATAT ---
        const regex = /^(.+)\s(\d+[\d\.,]*(?:k|rb|jt)?)(?:\s(mandiri|cash))?$/i;
        const match = input.match(regex);
        if (match) {
            let namaItem = match[1].trim();

            if (namaItem.toLowerCase().startsWith('history') || namaItem.toLowerCase().startsWith('riwayat')) {
                return;
            }

            let hargaRaw = match[2].toLowerCase().replace(/,/g, '.');
            let mtdInput = match[3] ? match[3].toLowerCase() : 'mandiri';
            let metodeFinal = mtdInput === 'cash' ? 'Cash' : 'Mandiri';
            let numericValue = parseFloat(hargaRaw);
            let nominalFinal = 0;

            if (hargaRaw.includes('k') || hargaRaw.includes('rb')) nominalFinal = numericValue * 1000;
            else if (hargaRaw.includes('jt')) nominalFinal = numericValue * 1000000;
            else nominalFinal = numericValue;

            if (isNaN(nominalFinal)) return;

            let tipe = 'Pengeluaran', subKategori = 'Lain-lain 📦';
            const namaLow = namaItem.toLowerCase();
            const keywordsPemasukan = ['gaji', 'masuk', 'bonus', 'transfer', 'hibah', 'lembur', 'jual', 'claim', 'refund'];
            
            if (keywordsPemasukan.some(k => namaLow.includes(k))) {
                tipe = 'Pemasukan'; subKategori = 'Income 💰';
            } else {
                const kategoriMap = {
                    'Anabul 🐾': ['kucing', 'cat', 'whiskas', 'pasir', 'grooming', 'petshop', 'meo', 'bolt', 'vet', 'yengki', 'pet'],
                    'Masak 🔥': ['belanja', 'pasar', 'telor', 'ikan', 'ayam', 'sayur'],
                    'Jajan 🥖': ['jajan', 'snack'],
                    'Konsumsi 🍔': ['makan', 'minum', 'nasi', 'buah', 'mie', 'bakso' , 'roti', 'warteg', 'sate', 'pecel', 'gorengan'],
                    'Transport 🚗': ['bensin', 'parkir', 'ojek', 'grab', 'gojek', 'bus', 'kereta', 'tol', 'ban', 'oli', 'service', 'steam', 'emoney', 'pertamax'],
                    'Kebutuhan 🏠': ['superindo', 'indomaret', 'listrik', 'wifi', 'sabun','sunlight', 'sampo', 'detergent', 'galon', 'gas', 'gigi', 'tisu', 'beras', 'odol', 'perlengkapan', 'deodoran'],
                    'Kesehatan 💊': ['obat', 'vitamin', 'dokter', 'apotek', 'masker', 'rs', 'klinik', 'p3k', 'paracetamol'],
                    'Hiburan 🎮': ['netflix', 'spotify', 'bioskop', 'game', 'topup', 'youtube', 'nonton', 'travel', 'tiket', 'kampung'],
                    'Pribadi 📚': ['liquid', 'kopi', 'pulsa', 'kuota', 'hairspray', 'kerja', 'kosiro', 'wardah', 'kantor', 'semester', 'tugas'],
                };
                for (const [key, keywords] of Object.entries(kategoriMap)) {
                    if (keywords.some(k => namaLow.includes(k))) { subKategori = key; break; }
                }
            }
            await axios.post(GOOGLE_SHEET_URL, { Kategori: tipe, SubKategori: subKategori, Metode: metodeFinal, Nominal: nominalFinal, Keterangan: namaItem });
            return msg.reply(`✅ *${tipe.toUpperCase()} BERHASIL*\n━━━━━━━━━━━━━━\n📂 *Sub:* ${subKategori}\n💳 *Metode:* ${metodeFinal}\n💰 *Nominal:* Rp ${nominalFinal.toLocaleString('id-ID')}\n📝 *Item:* ${namaItem}`);
        }
    } catch (error) { console.error("System Error:", error.message); }
});

client.initialize();
