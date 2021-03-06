# Nginx, Docker, NodeJS/ Express, ElasticSearch and Kibana

This is an essential example to build docker with ElasticSearch, Kibana and NodeJS/ Express.

Step to run
1. Clone the [repo](https://github.com/diegothucao/docker-modejs-elastic-search)
2. Run development mode `docker-compose up --build`. (Can consider to delete all containers and images for sure by `docker rm $(docker ps -aq) -f` and `docker image rm $(docker images -a -q) -f` before running `docker-compose up --build`).
3. Open [localhost](http://localhost:9200) to see if ElasticSearch works
4. If it works then open source code folder, open terminal (command) then `cd` to `data` folder 
5. Run Bulk `curl -H 'Content-Type: application/x-ndjson' -XPOST 'localhost:9200/bank/account/_bulk?pretty' --data-binary @accounts.json` to import test data to ElasticSearch
6. Run open browser: 

    6.1 [http://localhost/all](http://localhost/all) to see all data

    6.2 [http://localhost/states/CA](http://localhost/states/CA), it searches state by `CA`, `CA` can be replaced by another state [here](https://en.wikipedia.org/wiki/List_of_states_and_territories_of_the_United_States)

    6.3 [http://localhost/must/states/CA/employers/Techade](http://localhost/must/states/CA/employers/Techade), `CA` can be replaed by another state and `Techade` can be replaced by another name. (`must` query test) 

    6.4 [http://localhost/mustnot/states/CA/employers/Techade](http://localhost/mustnot/states/CA/employers/Techade), (`must not` query test) 

    6.5 [http://localhost/accounts/516](http://localhost/accounts/516), (`term` query test), '516' can be replace by another account number.

Create docker-compose

```javascript 
version: '3.7'
services:
  diego-elasticsearch-nginx:
    container_name: diego-elasticsearch-nginx
    build:
      dockerfile: Dockerfile
      context: ./nginx
    ports:
      - "80:80"
    networks:
      - diego

  diego-elasticsearch-server:
    build:
      context: .
      dockerfile: ./Dockerfile
    container_name: diego-elasticsearch-server
    restart: always
    ports:
      - "8080:8080"
    volumes:
      - .:/diego
    tty: true
    environment:
      PORT: 8080
    networks:
      - diego

  diego-elasticsearch:
    restart: always
    image: docker.elastic.co/elasticsearch/elasticsearch:7.3.1
    container_name: diego-elasticsearch
    environment:
      - node.name=diego-elasticsearch
      - discovery.seed_hosts=diego-elasticsearch-second
      - cluster.initial_master_nodes=diego-elasticsearch,diego-elasticsearch-second
      - cluster.name=docker-cluster
      - bootstrap.memory_lock=true
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    ulimits:
      memlock:
        soft: -1
        hard: -1
    volumes:
      - esdata01:/usr/share/elasticsearch/data
    ports:
      - 9200:9200
    networks:
      - diego
  
  diego-elasticsearch-second:
    restart: always
    image: docker.elastic.co/elasticsearch/elasticsearch:7.3.1
    container_name: diego-elasticsearch-second
    environment:
      - node.name=diego-elasticsearch-second
      - discovery.seed_hosts=diego-elasticsearch
      - cluster.initial_master_nodes=diego-elasticsearch,diego-elasticsearch-second
      - cluster.name=docker-cluster
      - bootstrap.memory_lock=true
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    ulimits:
      memlock:
        soft: -1
        hard: -1
    volumes:
      - esdata02:/usr/share/elasticsearch/data
    networks:
      - diego

  diego-kibana:
    restart: always
    container_name: diego-kibana
    image: docker.elastic.co/kibana/kibana:7.3.1
    ports:
      - "5601:5601"   
    networks:
      - diego
    environment:
      ELASTICSEARCH_HOSTS: http://diego-elasticsearch:9200

volumes:
  esdata01:
    driver: local
  esdata02:
    driver: local

networks:
  diego:
    driver: bridge
```

Make some simply query to test 
```javascript 
import { Client } from '@elastic/elasticsearch'

const client = new Client({ node: process.env.EL_URL })

export const getAll = async function getAll() {
    const { body } = await client.search({
      index: 'bank'
    })
    return body.hits.hits
  }


export const searhState = async function searhState(state) {
    const { body } = await client.search({
      index: 'bank',
      body: {
        query: {
          match: { state: state }
        }
      }
    })
  
    return body.hits.hits
  }
  
  export const searhStateAndEmployer = async function searhStateAndEmployer(state, employer) {
    const { body } = await client.search({
      index: 'bank',
      body: {
        query: {
          bool: {
            must: [
              { match: { state: state } },
              { match: { employer: employer } },
            ]
          }
        }
      }
    })
    return body.hits.hits
  }

    
  export const searhNotStateAndEmployer = async function searhNotStateAndEmployer(state, employer) {
    const { body } = await client.search({
      index: 'bank',
      body: {
        query: {
          bool: {
            must_not: [
              { match: { state: state } },
              { match: { employer: employer } },
            ]
          }
        }
      }
    })
    return body.hits.hits
  }

  export const termAccountNumber = async function termAccountNumber(account_number) {
    const { body } = await client.search({
      index: 'bank',
      body: {
        query: {
          term: {
            account_number: account_number
          }
        }
      }
    })
    return body.hits.hits
  }
```

And Simple NodeJS if needed 
```Javascript 
import cors from 'cors'
import { urlencoded, json } from 'body-parser'
import dotenv from 'dotenv'
import express from 'express'
import { searhState, searhStateAndEmployer, searhNotStateAndEmployer, termAccountNumber }  from './Query'
dotenv.load()

const app = express()
app.use(urlencoded({ extended: true, limit: '500mb' }))
app.use(json({ extended: true, limit: '500mb' }))
app.use(cors())

app.get('/all', (_, res) => {
  getAll().then(data => {
    res.send(data)
  })
})

app.get('/states/:state', (req, res) => {
  searhState(req.params.state).then(data => {
    res.send(data)
  })
})

app.get('/must/states/:state/employers/:employer', (req, res) => {
  searhStateAndEmployer(req.params.state, req.params.employer).then(data => {
    res.send(data)
  })
})


app.get('/mustnot/states/:state/employers/:employer', (req, res) => {
  searhNotStateAndEmployer(req.params.state, req.params.employer).then(data => {
    res.send(data)
  })
})

app.get('/accounts/:accountNumber', (req, res) => {
  termAccountNumber(req.params.accountNumber).then(data => {
    res.send(data)
  })
})

let server = app.listen(process.env.PORT || 8080)
server.setTimeout(500000)

```

If you see any issue, please do not hesitate to create an issue here or can contact me via email cao.trung.thu@gmail.com or [Linkedin](https://www.linkedin.com/in/diegothucao/)

Thanks
	
references
 1. https://docs.docker.com/install/
 2. https://www.elastic.co


