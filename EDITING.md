# Editing the portfolio

Everything you'll normally change lives in **`content/`**: plain JSON and Markdown files. There's no build step, so you edit a file, refresh the page, commit and push.

## 1. Preview locally

The pages load `content/*.json` with `fetch`, which browsers block for `file://` pages. Serve the folder instead:

```bash
cd D:\Dev\FahimFuad.github.io
python -m http.server 8000
```

Then open http://localhost:8000. If you edit a JSON file and see `Could not load content/...`, the JSON almost certainly has a syntax error, usually a missing or extra comma. Paste it into https://jsonlint.com to find it.

## 2. Where things are

```
index.html                 Home (voxel name, about, featured, project scroller, stack, blog, contact)
projects/index.html        All projects (filterable grid)
projects/project.html      Generic project page: project.html?id=<slug>
blog/index.html            All posts
blog/post.html             One post: post.html?p=<slug>
resume/index.html          Resume (print button makes a clean PDF)
404.html                   Not found page

content/profile.json       Your name, bio, "now" line, socials, email, resume PDF
content/projects.json      Every project (order = order on the site)
content/projects/*.md      Optional long write-ups for projects
content/posts.json         Every blog post (newest first is automatic)
content/posts/*.md         Post bodies
content/resume.json        Resume sections and skills

assets/img/projects/       Project covers and screenshots
assets/css/base.css        All styling (colors are the variables at the top)
assets/js/site.js          Nav links (NAV), footer, transitions, Markdown, covers
assets/js/world.js         The 3D voxel world (shapes, cube count, lighting)
assets/js/pages/*.js       One script per page
```

**Paths:** every path you write in `content/` (JSON *and* Markdown) is relative to the **site root**, like `assets/img/projects/foo.webp` or `content/posts/img/bar.webp`. No leading `/`. GitHub Pages is case-sensitive: `Foo.webp` and `foo.webp` are different files.

## 3. Your info

Edit `content/profile.json`:

| Field | What it does |
|---|---|
| `name`, `alias`, `role`, `location`, `affiliation` | `name` is the big headline on the home page (last word in amber); `role` sits above it. Also used in the footer and resume. |
| `now`, `nowUpdated` | The "Now (Oct 2026):" line under your bio. Update the date when you change it, a stale "now" is worse than none. |
| `bio` | Paragraphs of the "Hey, I'm Rid." section. Write them the way you talk. |
| `email` | Empty = hidden. Fill it to get a mail button on Contact and a line on the resume. |
| `resumePdf` | Empty = hidden. Put a PDF at e.g. `assets/resume.pdf` and write that path to get a Download PDF button. |
| `socials` | The contact card + footer links: `{ "label", "handle", "url", "icon" }`. `icon` is a file name from `assets/img/icons/` (github, discord, x, facebook, instagram, steam, reddit). For a new one, download its SVG from https://simpleicons.org into that folder; without an icon you get a generic link symbol. The Discord and GitHub entries also become the two buttons next to the card. |
| `timezone` | Drives the live "It's 2:17 PM in Bangladesh right now" line on the contact section (an IANA name like `Asia/Dhaka`). Remove it to hide the line. |

## 4. Projects

Every project is one object in `content/projects.json`. The order in the file is the order on the site.

```json
{
    "slug": "my-game",
    "title": "My Game",
    "summary": "One or two sentences. Shown on cards and at the top of the project page.",
    "year": "2026",
    "role": "Solo developer",
    "category": "Game",
    "status": "Complete",
    "tags": ["C++", "Surge Engine"],
    "cover": "assets/img/projects/my-game.webp",
    "repo": "https://github.com/ridhwandll/MyGame",
    "links": [{ "label": "Play on itch.io", "url": "https://..." }],
    "gallery": ["assets/img/projects/my-game-1.webp", "assets/img/projects/my-game-2.webp"],
    "body": "content/projects/my-game.md",
    "shape": "planet",
    "featured": true
}
```

| Field | Required | Notes |
|---|---|---|
| `slug` | yes | Unique, lowercase, no spaces. It becomes the URL: `projects/project.html?id=my-game`. |
| `title`, `summary`, `year`, `category` | yes | `category` builds the filter buttons on the Projects page automatically. |
| `role`, `status`, `tags` | no | Shown as fact tiles and tags. |
| `cover` | no | Without one, the site draws a unique voxel cover from the slug. 16:10 images look best; around 1280px wide WebP is plenty. |
| `repo` | no | "Source on GitHub" button. The project page also shows the repo's README, fetched live from GitHub. |
| `links` | no | Extra buttons (downloads, store pages, videos). |
| `gallery` | no | Screenshots under the cover (click to enlarge). |
| `body` | no | A Markdown write-up rendered on the project page instead of the GitHub README. |
| `page` | no | The project has **its own website** inside the portfolio (see below). Cards link straight to it. |
| `external` | no | The project lives **somewhere else** (a URL). Cards link straight to it. |
| `shape` | no | The 3D shape behind the project page: `planet`, `cube`, `lattice`, `ring`, `knot`, `helix`, `galaxy`, `wave`, `none`. |
| `featured` | no | `true` = shows in the project scroller on the home page. The first featured project is the big "featured" block. |

### Add a new project

1. Add the object to `content/projects.json` (copy an existing one and change it; mind the commas between objects).
2. Optional: drop a cover in `assets/img/projects/` and point `cover` at it.
3. Optional: copy `content/projects/_TEMPLATE.md` to `content/projects/<slug>.md`, write it, and set `"body"`.
4. Refresh. It appears on the Projects page, and in the home page scroller if `featured`.

### Add an existing project

You'll have projects in one of three states. Pick the matching recipe:

**a) It's a GitHub repo with a README.**
Add the JSON entry with `"repo"`. That's it: the project page fetches the README from GitHub every visit, so editing the README on GitHub updates the site. Its first `# Title` is dropped (the page already shows the title), and relative images and links point back into the repo. If you'd rather write something different from the README, set `"body"` and the local Markdown is used instead.

**b) It already has its own website** (static HTML/CSS/JS).
1. Copy the whole site folder to `projects/<slug>/` (its `index.html` must be at `projects/<slug>/index.html`).
2. Make sure its links to its own files are **relative** (`assets/app.js`, not `/assets/app.js`), because it now lives in a subfolder.
3. Add the JSON entry with `"page": "projects/<slug>/"`. Every card and the home page scroller now open it directly.
4. Give visitors a way back: add this anywhere in its header:
   ```html
   <a href="../../">&lt;- Fahim Fuad</a> / <a href="../">projects</a>
   ```

**c) It's hosted somewhere else** (itch.io, a web app, a video).
Add the JSON entry with `"external": "https://..."`. Cards open that URL. You can still add a `body`, but nothing links to the generic page in that case.

### Remove or reorder

Delete the object, or move it up or down in the array.

## 5. Blog posts

1. Copy `content/posts/_TEMPLATE.md` to `content/posts/<slug>.md` and write the post in Markdown (code blocks with ```` ```cpp ````, ```` ```lua ````, ```` ```glsl ````, ```` ```matlab ````, ```` ```csharp ````, ```` ```bash ```` and ```` ```json ```` are highlighted).
2. Add an entry to `content/posts.json`:
   ```json
   {
       "slug": "render-graph-notes",
       "title": "Notes on Surge's render graph",
       "date": "2026-10-20",
       "summary": "Shown in the post list.",
       "tags": ["Graphics", "Surge"],
       "file": "content/posts/render-graph-notes.md"
   }
   ```
3. Images go in `content/posts/img/` and are referenced as `![alt](content/posts/img/name.webp)`.

Posts are sorted by `date` (YYYY-MM-DD), newest first. Add `"draft": true` to hide a post without deleting it. The three newest posts show on the home page.

## 6. Resume

`content/resume.json` has a `summary`, a list of `sections` (each with `items`: `title`, `org`, `period`, optional `link` and `points`), `skills` groups and `languages`. Add or remove sections freely; they render in order. The skills groups also feed the "Stack" section on the home page.

To make a PDF: open the Resume page and press **Print / save as PDF** (Ctrl+P). The print layout drops the 3D, nav and colors.

## 7. Navigation

The nav is generated from the `NAV` array at the top of `assets/js/site.js`. Add `{ label: 'Talks', href: 'talks/' }` and create `talks/index.html` (copy `blog/index.html`, keep `data-root="../"`, and point it at your own script).

## 8. Look and feel

- **Colors:** the variables at the top of `assets/css/base.css` (`--amber`, `--surface`, `--bg` ...).
- **Fonts:** Encode Sans (text) and JetBrains Mono (typed things) are self-hosted in `assets/fonts/` (both OFL).
- **3D world:** in `assets/js/world.js`, `VoxelWorld` picks 3600 cubes on desktop and 1400 on phones (`this.count`). On the home page each `<section>` chooses its shape with `data-shape`, and its position with `data-x` (-1 left ... 1 right) and `data-y`.

## 9. Publish

```bash
git add -A
git commit -m "Update portfolio"
git push
```

GitHub Pages serves the `master` branch root at https://ridhwandll.github.io/ (Settings > Pages > Deploy from a branch). It usually updates within a minute. `.nojekyll` makes Pages serve files as they are.
