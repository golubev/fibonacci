const keys = require('./keys');

// Express App Setup
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Postgres Client Setup

const { Pool } = require('pg');
const pgClient = new Pool({
    user: keys.pgUser,
    host: keys.pgHost,
    database: keys.pgDatabase,
    password: keys.pgPassword,
    port: keys.pgPort,
});

pgClient.on('error', () => console.log('something failed with PG connection'));

pgClient.on('connect', client => {
    console.log('running PG on connect');
    client
        .query('CREATE TABLE IF NOT EXISTS values (number INT)')
        .catch(err => console.error(err));
});

// Redis Client Setup
const redis = require('redis');
const redisClient = redis.createClient({
    host: keys.redisHost,
    port: keys.redisPort,
    retry_strategy: () => 1000,
});
const redisPublisher = redisClient.duplicate();

// Express Route Handlers

app.get('/', (request, response) => {
    response.send('Hi');
});

app.get('/values/all', async (request, response) => {
    const values = await pgClient.query('SELECT * FROM values');

    response.send(values.rows);
});

app.get('/values/current', async (request, response) => {
    redisClient.hgetall('values', (err, values) => {
        response.send(values);
    });
});

app.post('/values', async (request, response) => {
    const index = request.body.index;

    if (parseInt(index) > 40) {
        return response.status(422).send('Index too high');
    }

    redisClient.hset('values', index, 'Nothing yet!');
    redisPublisher.publish('insert', index);
    pgClient.query('INSERT INTO values (number) VALUES($1)', [index]);
    response.send(
        {
            working: true,
        }
    );
});

app.listen(5000, (err) => {
    console.log('Listening')
});
