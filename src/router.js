/**
 * Hash router: #/intro #/guide #/globe #/continents #/how
 */
import { state, setState } from './state.js';

const routes = ['intro', 'guide', 'globe', 'continents', 'how', 'start'];

let _onNavigate = null;

export function setNavigateCallback(fn) { _onNavigate = fn; }

export function navigate(page) {
  const p = routes.includes(page) ? page : 'globe';
  window.location.hash = '#/' + p;
}

export function initRouter() {
  function handle() {
    const hash = window.location.hash.replace('#/', '') || 'start';
    const page = routes.includes(hash) ? hash : 'globe';
    setState({ page });
    if (_onNavigate) _onNavigate(page);
  }
  window.addEventListener('hashchange', handle);
  handle();
}
