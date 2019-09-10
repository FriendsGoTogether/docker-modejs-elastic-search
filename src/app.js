import cors from 'cors'
import { urlencoded, json } from 'body-parser'
import dotenv from 'dotenv'
import express from 'express'
import { Client } from '@elastic/elasticsearch'

dotenv.load()

const client = new Client({ node: process.env.EL_URL })
const app = express()
app.use(urlencoded({ extended: true, limit: '500mb' }))
app.use(json({ extended: true, limit: '500mb' }))
app.use(cors())

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

let server = app.listen(process.env.PORT || 8080)
server.setTimeout(500000)

async function searhState(state) {
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

async function searhStateAndEmployer(state, employer) {
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


