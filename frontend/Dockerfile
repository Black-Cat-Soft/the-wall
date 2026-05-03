# Dev image: matches docker-compose (bind mounts + `npm run dev`).
# For a static nginx production image, use a separate Dockerfile or CI build step.
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
