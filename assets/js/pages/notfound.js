// 404: PowerShell can't find it either.
import { $, esc } from '../site.js';

let asked = location.pathname;
try { asked = decodeURIComponent(asked); } catch (e) {}
const path = `D:\\Rid${asked.replace(/\//g, '\\')}`;
$('#nf-log').innerHTML = `<span class="ps">PS D:\\Rid&gt;</span> Set-Location ${esc(path)}
<span class="err">Set-Location : Cannot find path '${esc(path)}' because it does not exist.
At line:1 char:1
+ Set-Location ${esc(path)}
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : ObjectNotFound: (${esc(path)}:String) [Set-Location], ItemNotFoundException
    + FullyQualifiedErrorId : PathNotFound,Microsoft.PowerShell.Commands.SetLocationCommand</span>

<span class="ps">PS D:\\Rid&gt;</span> <span class="caret"></span>`;
