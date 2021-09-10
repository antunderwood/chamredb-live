FROM node:lts-alpine
COPY ./ /charmed/
WORKDIR /charmed

ENV NODE_ENV=production

# install  deps
RUN npm install

# runs webpack build
RUN npm run build

CMD [ "npm", "start" ]

