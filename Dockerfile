# Gunakan Node.js 18 versi ringan
FROM node:18-alpine

# Install Chromium dan dependensinya untuk Puppeteer
RUN apk add --no-cache     chromium     nss     freetype     harfbuzz     ca-certificates     ttf-freefont

# Beri tahu Puppeteer untuk menggunakan Chromium yang baru diinstal
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Set folder kerja di dalam Docker
WORKDIR /usr/src/app

# Copy package.json dan install dependency
COPY package*.json ./
RUN npm install --omit=dev

# Copy seluruh file bot
COPY . .

# Perintah menjalankan bot
CMD ["node", "app.js"]
