#!/usr/bin/env node
// Moves the GSA/dcat-us submodule to a commit and records the pin, or checks the
// record matches the submodule. Runs git only, never code from the submodule.
//
//   npm run schema:update -- <full commit SHA, or a branch such as main>
//   npm run schema:check
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const sub = new URL('../schema/dcat-us/', import.meta.url)
const pinFile = new URL('../schema/dcat-us.pin.json', import.meta.url)

const git = (...args) => execFileSync('git', args, { cwd: sub, encoding: 'utf8' }).trim()
const fail = (message) => {
  console.error(message)
  process.exit(1)
}

/** The pin record for the submodule's checked-out commit. */
function pin() {
  // A licence change upstream must be reviewed by a person, not recorded silently.
  if (!readFileSync(new URL('LICENSE.md', sub), 'utf8').includes('CC0 1.0 Universal')) {
    fail('dcat-us LICENSE.md is no longer CC0 1.0. Review the new licence before pinning.')
  }
  const record = {
    repository: 'https://github.com/GSA/dcat-us',
    commit: git('rev-parse', 'HEAD'),
    date: git('log', '-1', '--format=%cI'),
    licence: 'CC0-1.0',
  }
  return JSON.stringify(record, null, 2) + '\n'
}

const [command, ref] = process.argv.slice(2)
// Without this, git would run against the parent repository.
if (!existsSync(new URL('jsonschema/definitions', sub))) {
  fail('The dcat-us submodule is not checked out. Run: git submodule update --init')
}
if (command === 'update' && ref) {
  git('fetch', '--quiet', 'origin', ref)
  git('checkout', '--quiet', '--detach', 'FETCH_HEAD')
  writeFileSync(pinFile, pin())
  console.log(`Pinned GSA/dcat-us at ${git('rev-parse', 'HEAD')}. Commit editor/schema/dcat-us and dcat-us.pin.json.`)
} else if (command === 'check') {
  const expected = pin()
  if (readFileSync(pinFile, 'utf8') !== expected) {
    fail(`editor/schema/dcat-us.pin.json does not match the submodule. Expected:\n${expected}`)
  }
  console.log('dcat-us pin matches the submodule.')
} else {
  fail('Usage: dcat-us-pin.mjs update <commit> | check')
}
