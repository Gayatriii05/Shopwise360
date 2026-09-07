FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3001

# Dev-mode Vite server (matches local workflow: port 3001 due to IIS on 3000).
# API/socket calls go straight to http://localhost:5000 via VITE_* env above.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]