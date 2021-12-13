const express = require('express');
const bodyParser = require('body-parser');
const { Op } = require('sequelize');
const db = require('./models');
const config = require('./config/config.json');
const fetch = require('node-fetch');
const { v4: uuid } = require('uuid');

const app = express();

app.use(bodyParser.json());
app.use(express.static(`${__dirname}/static`));

app.get('/api/games', (req, res) =>
  db.Game.findAll()
    .then((games) => res.send(games))
    .catch((err) => {
      console.log('There was an error querying games', JSON.stringify(err));
      return res.send(err);
    }),
);

app.post('/api/games', (req, res) => {
  const { publisherId, name, platform, storeId, bundleId, appVersion, isPublished } = req.body;
  return db.Game.create({ publisherId, name, platform, storeId, bundleId, appVersion, isPublished })
    .then((game) => res.send(game))
    .catch((err) => {
      console.log('***There was an error creating a game', JSON.stringify(err));
      return res.status(400).send(err);
    });
});

app.delete('/api/games/:id', (req, res) => {
  // eslint-disable-next-line radix
  const id = parseInt(req.params.id);
  return db.Game.findByPk(id)
    .then((game) => game.destroy({ force: true }))
    .then(() => res.send({ id }))
    .catch((err) => {
      console.log('***Error deleting game', JSON.stringify(err));
      res.status(400).send(err);
    });
});

app.put('/api/games/:id', (req, res) => {
  // eslint-disable-next-line radix
  const id = parseInt(req.params.id);
  return db.Game.findByPk(id).then((game) => {
    const { publisherId, name, platform, storeId, bundleId, appVersion, isPublished } = req.body;
    return game
      .update({ publisherId, name, platform, storeId, bundleId, appVersion, isPublished })
      .then(() => res.send(game))
      .catch((err) => {
        console.log('***Error updating game', JSON.stringify(err));
        res.status(400).send(err);
      });
  });
});

app.get('/api/games/search', (req, res) => {
  let { name, platform } = req.query;

  // Build Query
  let option = {};
  if (name) {
    name = name?.replace(/\"/g, '');
    option['where'] = {
      name: {
        [Op.like]: `%${name}%`,
      },
    };
  }

  if (platform) {
    platform = platform?.toLowerCase()?.replace(/\"/g, '');

    if (platform !== 'all') {
      option['where'] = {
        platform: `${platform}`,
      };
    }
  }

  db.Game.findAll(option)
    .then((games) => {
      res.json(games);
    })
    .catch((err) => {
      console.log('***Error searching game', JSON.stringify(err));
      res.status(400).send(err);
    });
});

app.post('/api/games/populate', async (req, res) => {
  const env = process.env.NODE_ENV || 'development';
  const url = config[env].googlePlay;

  try {
    let response = await fetch(url);
    response = await response.json();

    // TODO: Let mock response. We will replace in future when we have an API

    response = await getMock();

    const queueGamesCreation = response.map(async (games) => {
      return db.Game.create(games);
    });

    await Promise.all(queueGamesCreation);

    res.json({ code: 'SUCCESS', msg: `Successfully Populated Database` });
  } catch (error) {
    console.log(`Error when fetching data ${JSON.stringify(error)}`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is up on port ${PORT}`);
});

const getMock = async () => {
  const mockData = [];

  while (mockData.length < 100) {
    mockData.push({
      publisherId: uuid(),
      name: (Math.random() + 1).toString(36).substring(7),
      platform: (Math.random() + 1).toString(36).substring(7),
      storeId: (Math.random() + 1).toString(36).substring(7),
      bundleId: uuid(),
      appVersion: 1,
      isPublished: false,
    });
  }

  return mockData;
};

module.exports = app;
