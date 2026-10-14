// 404: the voxels spell it out.
import { $, startWorld } from '../site.js';

$('#nf-path').textContent = location.pathname;
startWorld({ shape: 'text:404', layout: { x: 0, y: 0.16 } });
