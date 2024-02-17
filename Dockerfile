FROM node:18.13
WORKDIR /app
COPY package.json package-lock.json ./
RUN NODE_ENV=development npm i
COPY . .
RUN npm run build && npm prune --production
ENV PORT 5050
EXPOSE 5050
CMD ["node", "build"]