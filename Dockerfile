FROM node:lts-alpine
COPY ./ /chAMReDb/
WORKDIR /chAMReDb

ENV NODE_ENV=production

# install produciton deps
RUN npm install --only=production

# runs webpack build
RUN npm run build

CMD [ "npm", "start" ]

