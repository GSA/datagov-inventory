#!/usr/bin/env node
// Moves the GSA/dcat-us submodule to a commit and records the pin, or checks the
// record matches the submodule. Runs git only, never code from the submodule.
//
//   npm run schema:update -- <full commit SHA, or a branch such as main>
//   npm run schema:check
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const repo = new URL('../../', import.meta.url)
const sub = new URL('../schema/dcat-us/', import.meta.url)
const pinFile = new URL('../schema/dcat-us.pin.json', import.meta.url)

const run = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
const git = (...args) => run(sub, ...args)
const fail = (message) => {
  console.error(message)
  process.exit(1)
}

/** The pin record for a commit, read from git objects rather than the working tree. */
function pin(rev) {
  // A licence change upstream must be reviewed by a person, not recorded silently.
  if (!git('show', `${rev}:LICENSE.md`).includes('CC0 1.0 Universal')) {
    fail('dcat-us LICENSE.md is no longer CC0 1.0. Review the new licence before pinning.')
  }
  const record = {
    repository: run(repo, 'config', '-f', '.gitmodules', 'submodule.editor/schema/dcat-us.url'),
    commit: git('rev-parse', `${rev}^{commit}`),
    date: git('log', '-1', '--format=%cI', rev),
    licence: 'CC0-1.0',
  }
  return JSON.stringify(record, null, 2) + '\n'
}

const [command, ref] = process.argv.slice(2)
// Without this, git would run against the parent repository.
if (!existsSync(new URL('jsonschema/definitions', sub))) {
  fail('The dcat-us submodule is not checked out. Run: git submodule update --init')
}
if (git('status', '--porcelain')) fail('editor/schema/dcat-us has local changes. Discard them first.')

if (command === 'update' && ref) {
  git('fetch', '--quiet', 'origin', '--end-of-options', ref)
  const record = pin('FETCH_HEAD')
  git('checkout', '--quiet', '--detach', 'FETCH_HEAD')
  writeFileSync(pinFile, record)
  console.log(`Pinned GSA/dcat-us at ${git('rev-parse', 'HEAD')}. Commit editor/schema/dcat-us and dcat-us.pin.json.`)
} else if (command === 'check') {
  const expected = pin('HEAD')
  if (readFileSync(pinFile, 'utf8') !== expected) {
    fail(`editor/schema/dcat-us.pin.json does not match the submodule. Expected:\n${expected}`)
  }
  console.log('dcat-us pin matches the submodule.')
} else {
  fail('Usage: dcat-us-pin.mjs update <commit> | check')
}
