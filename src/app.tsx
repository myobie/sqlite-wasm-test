import toHex from 'array-buffer-to-hex'
import { useSignal, signal } from '@preact/signals'
import { useRef } from 'preact/hooks'
import './app.css'
import init from 'sql.js'
import wasm from 'sql.js/dist/sql-wasm.wasm?url'

const _db = signal<init.Database | undefined>(undefined)

init({
  locateFile: () => wasm
}).then(SQL => {
  const newDB = new SQL.Database()

  const createTables = `
  create table if not exists items (
    id integer primary key autoincrement,
  name text
  );

  create table if not exists subitems (
    id integer primary key autoincrement,
  item_id integer references items (id),
  name text
  );
  `

  newDB.run(createTables)

  _db.value = newDB

  // @ts-ignore expose onto the window
  window._db = newDB
})


export function App() {
  const hasDB = !!_db.value
  const hasClicked = useSignal<boolean>(false)
  const rowCount = useSignal<number>(0)

  async function doCreate(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    hasClicked.value = true

    for await (const totalRows of createATonOfRows()) {
      rowCount.value = totalRows
    }
  }

  function doExport(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    exportDB()
  }

  return (
    <div class='app'>
      <p>Rows in DB: {rowCount}</p>
      <button disabled={hasClicked || !hasDB} onClick={doCreate}>Create a ton of rows</button>
      <button disabled={!hasDB} onClick={doExport}>Export DB</button>
      {hasDB && <Query />}
    </div>
  )
}

const Query = () => {
  const isRunning = useSignal<boolean>(false)
  const result = useSignal<string>('enter a query above…')
  const input = useRef<HTMLInputElement>(null)

  function submit(e: Event) {
    e.preventDefault()
    e.stopPropagation()

    isRunning.value = true

    try {
      const db = _db.value!
      let sql = input.current!.value.trim()

      if (!sql.endsWith(';')) {
        sql += ';'
      }

      const start = window.performance.now()
      const res = db.exec(sql)
      const elapsedTime = window.performance.now() - start

      result.value = `executed in ${elapsedTime}ms\n${JSON.stringify(res, null, 2)}`
    } catch (e) {
      result.value = String(e)
    } finally {
      isRunning.value = false
    }
  }

  return (
    <form class='query' onSubmit={submit}>
      <input class='input' disabled={isRunning} ref={input} />
      <button type='submit' disabled={isRunning}>Run</button>
      <pre class='pre'>{result}</pre>
    </form>
  )
}

function exportDB() {
  const db = _db.value!
  const contents = db.export()
  const blob = new Blob([contents], { type: 'application/vnd.sqlite3' })
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'db.sqlite'
  anchor.click()

  URL.revokeObjectURL(url)
}

async function* createATonOfRows(): AsyncGenerator<number> {
  console.time('createATonOfRows')
  const amountOfItems = 500000

  for (let i = 1; i < amountOfItems; ++i) {
    const id = createItem()
    createSubitem(id)
    createSubitem(id)

    if (i % 200 === 0) {
      yield i * 3
      await wait()
    }
  }

  yield amountOfItems * 3
  console.timeEnd('createATonOfRows')
}

function createItem(): number {
  const db = _db.value!
  const name = randomName()
  const [{values: [[id]]}] = db.exec('insert into items (name) values (?) returning id', [name])
  return id as number
}

function createSubitem(itemId: number): number {
  const db = _db.value!
  const name = randomName()
  const [{values: [[id]]}] = db.exec('insert into subitems (item_id, name) values (?, ?) returning id', [itemId, name])
  return id as number
}

function randomName(): string {
  const buffer = new Uint8Array(16)
  crypto.getRandomValues(buffer)
  return toHex(buffer)
}

async function wait() {
  return new Promise(r => requestAnimationFrame(r))
}
