FROM node:22-slim
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY . .
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run build
ENV NODE_ENV=production
CMD ["npm", "start"]
