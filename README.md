cat << 'EOF' > README.md
# MY-WHATSAPP-BOT 🤖

Script Bot WhatsApp otomatis berbasis Node.js untuk server Ubuntu.

---

## ⚡ CARA 1: Jalankan Instant (Sekali Copas Beres)

Jika kamu berada di server Ubuntu baru, silakan **salin semua kode di bawah ini**, paste ke terminal, lalu tekan **Enter**. Perintah ini akan otomatis menginstall Node.js, NPM, PM2, men-download library, dan langsung menjalankan bot-nya:

```bash
sudo apt update && sudo apt install nodejs npm -y && npm install && sudo npm install pm2 -g && pm2 start app.js --name "whatsapp-bot" && pm2 logs whatsapp-bot
