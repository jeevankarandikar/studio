import { expect, test } from 'claude-code/testing'
import { DONE_NOTE, PLAN_NOTE, RESUME_NOTE, longNote, notesFor, unproven } from './register'

test('a task with no check gets the done note, and one with a check gets none', () => {
  expect(notesFor('fix the onboarding wizard it looks messy')).toEqual([DONE_NOTE])
  expect(notesFor('fix the wizard and prove it with a screenshot')).toEqual([])
  expect(notesFor('rename the Water tab to Hydration')).toEqual([DONE_NOTE])
})

test('a bare resume gets the resume note, typos included', () => {
  for (const p of ['continue', 'continuew', 'conitnue', 'Try again', 'update?', 'whats next']) {
    expect(notesFor(p)).toEqual([RESUME_NOTE])
  }
})

test('answers, questions, commands and machine messages get nothing', () => {
  for (const p of ['yes', 'ran it', 'why only 16?', 'how do we make mods?', '/compact', '<task-notification>build everything</task-notification>']) {
    expect(notesFor(p)).toEqual([])
  }
})

test('a wide prompt gets the plan note, and a long session gets the count', () => {
  expect(notesFor('keep going overnight and build everything you can')).toEqual([PLAN_NOTE, DONE_NOTE])
  expect(notesFor('yes', 40)).toEqual([longNote(40)])
  expect(notesFor('yes', 41)).toEqual([])
})

test('a claim counts only in prose, unnegated, in a turn where nothing ran', () => {
  expect(unproven('The panel is verified.', false)).toBe('verified')
  expect(unproven('The panel is verified.', true)).toBe('')
  expect(unproven('I have not verified this.', false)).toBe('')
  expect(unproven('Edited the file. Nothing was run.', false)).toBe('')
  expect(unproven('The check prints `tests pass` when green.', false)).toBe('')
})
