FROM node:22-alpine

RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    librsvg-dev

WORKDIR /usr/src/app

COPY . .

RUN npm install

EXPOSE 3000

ENV HOST="0.0.0.0"
ENV PORT=3000

CMD ["node", "."]
