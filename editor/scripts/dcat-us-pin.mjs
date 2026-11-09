#!/usr/bin/env node
// Moves the GSA/dcat-us submodule to a given commit and records the pin, or
// checks that the recorded pin matches the submodule. Uses git only: nothing
// from the submodule is executed.
//
//   npm run schema:update -- <full commit SHA, or a branch such as main>
//   npm run schema:check
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const editorDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const submoduleDir = join(editorDir, 'schema', 'dcat-us')
const pinFile = join(editorDir, 'schema', 'dcat-us.pin.json')
const licenceFile = 'LICENSE.md'
const definitionsDir = 'jsonschema/definitions'

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

function requireCheckout() {
  if (!existsSync(join(submoduleDir, definitionsDir))) {
    fail('The dcat-us submodule is not checked out. Run: git submodule update --init')
  }
}

// The licence is read, not assumed: a change upstream must be a conscious decision here.
function readLicence() {
  const text = readFileSync(join(submoduleDir, licenceFile), 'utf8')
  if (!/CC0 1\.0 Universal/.test(text)) {
    fail(`${licenceFile} in dcat-us is no longer CC0 1.0. Review the new licence before pinning.`)
  }
  return 'CC0-1.0'
}

/** The pin record for whatever commit the submodule has checked out. */
function describeCheckout() {
  return {
    repository: 'https://github.com/GSA/dcat-us',
    commit: git(submoduleDir, 'rev-parse', 'HEAD'),
    date: git(submoduleDir, 'log', '-1', '--format=%cI', 'HEAD'),
    licence: readLicence(),
    licenceFile,
    definitions: definitionsDir,
  }
}

function render(pin) {
  return JSON.stringify(pin, null, 2) + '\n'
}

function update(ref) {
  if (!ref) fail('Usage: npm run schema:update -- <full commit SHA or branch>')
  requireCheckout()
  git(submoduleDir, 'fetch', '--quiet', 'origin', ref)
  git(submoduleDir, 'checkout', '--quiet', '--detach', 'FETCH_HEAD')
  const pin = describeCheckout()
  writeFileSync(pinFile, render(pin))
  const sub = relative(join(editorDir, '..'), submoduleDir)
  console.log(`Pinned GSA/dcat-us at ${pin.commit} (${pin.date}).`)
  console.log(`Next: git add ${sub} ${relative(join(editorDir, '..'), pinFile)} and run the tests.`)
}

function check() {
  requireCheckout()
  const pin = describeCheckout()
  // The commit the superproject records for the submodule (the index, so staged bumps count).
  const sub = relative(join(editorDir, '..'), submoduleDir)
  const gitlink = git(editorDir, 'ls-files', '--stage', '--', relative(editorDir, submoduleDir)).split(/\s+/)[1]
  const problems = []
  if (gitlink !== pin.commit) {
    problems.push(`${sub} is checked out at ${pin.commit}, but the repository records ${gitlink}.`)
  }
  const recorded = existsSync(pinFile) ? readFileSync(pinFile, 'utf8') : ''
  if (recorded !== render(pin)) {
    problems.push(`${relative(join(editorDir, '..'), pinFile)} does not match the submodule. Expected:\n${render(pin)}`)
  }
  if (problems.length > 0) {
    fail(`${problems.join('\n')}\nRun npm run schema:update -- <commit> to move the pin.`)
  }
  console.log(`dcat-us pin OK: ${pin.commit} (${pin.date}), ${pin.licence}.`)
}

const [command, ref] = process.argv.slice(2)
if (command === 'update') update(ref)
else if (command === 'check') check()
else fail('Usage: dcat-us-pin.mjs update <commit> | check')
