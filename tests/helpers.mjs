import {Cell} from '../src/simulation.mjs';
export function chosenCell(){const c=new Cell();c.command('recipe',{body:'B1',cap:'C1',top:'T1',count:1,destination:'collect'});return c;}
