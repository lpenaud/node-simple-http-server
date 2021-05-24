import { EventEmitter } from 'events'

/**
 * Symbol to represent the done event when a asynchronous task is done.
 */
export const DONE_EVENT = Symbol('DONE EVENT')

/**
 * Symbol to represent the end event when all the asynchronous tasks are done.
 */
export const END_EVENT = Symbol('END EVENT')

/**
 * Callback after an asynchronous task is done.
 * @callback AsyncCallback
 * @param {...any} results Result of the asynchronous task.
 * @returns {void} Ignore the returned value.
 */

/**
 * Asyncronous tasks ready to run.
 * @callback AsyncTask
 * @param {AsyncCallback} callback Callback to call when the task is done.
 * @returns {void} Ignore the returned value.
 */

/**
 * Queue the asynchronous tasks.
 * @param {Iterable<AsyncTask>} functions Asynchronous task to put in the queue.
 * @returns {EventEmitter} Emitter to be listened to with DONE and END events.
 */
export function asyncQueue(functions) {
  const it = functions[Symbol.iterator]()
  const emitter = new EventEmitter()
  const callback = (...results) => {
    emitter.emit.apply(emitter, results)
    factory()
  }
  const task = next => {
    if (next.done) {
      emitter.emit(END_EVENT)
    } else {
      next.value(callback)
    }
  }
  const factory = () => queueMicrotask(task.bind(undefined, it.next()))
  factory()
  return emitter
}

/**
 * Put asynchronous tasks in the event loop.
 * @param {Iterable<AsyncTask>} functions Asynchronous task to put in the event loop.
 * @returns {EventEmitter} Emitter to be listened to with DONE and END events.
 */
export function asyncParallel(functions) {
  const emitter = new EventEmitter()
  const it = functions[Symbol.iterator]()
  const callback = (...results) => {
    emitter.emit.apply(emitter, results)
    if (it.next().done) {
      emitter.emit(END_EVENT)
    }
  }
  for (const func of functions) {
    queueMicrotask(func.bind(undefined, callback))
  }
  if (it.next().done) {
    queueMicrotask(emitter.emit.bind(emitter, END_EVENT))
  }
  return emitter
}
