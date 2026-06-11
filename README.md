# MDECK — motor de prezentări web din Markdown

Soluție 100% web (HTML + CSS + JavaScript, fără build) pentru prezentări de tip slide deck. Fiecare prezentare este un **director**, iar fiecare slide este un **fișier Markdown**.

Acest repo conține doar **motorul** (BASE): viewer-ul, pagina de start, stilurile și o prezentare `demo/` ca exemplu. Conținutul (prezentările reale) stă în repo-uri separate care folosesc motorul — vezi [Embedding](#embedding-folosirea-motorului-din-alt-repo).

Markdown-ul este redat cu [markdown-it](https://github.com/markdown-it/markdown-it) (CommonMark + tabele GFM + linkify), iar codul este colorat cu [highlight.js](https://highlightjs.org/) — ambele **vendorizate local** în `assets/vendor/`, deci totul funcționează offline / pe intranet, fără CDN. `assets/md.js` e doar un adaptor subțire care adaugă frontmatter-ul per slide și containerele `:::`.

## Structura

```
mdeck/
├── index.html                  # pagina de start (lista prezentărilor)
├── deck.html                   # viewer universal: deck.html?p=<director>
├── assets/
│   ├── style.css               # identitate vizuală + pagina de start
│   ├── deck.css                # stilurile viewer-ului
│   ├── home.js                 # logica paginii de start
│   ├── deck.js                 # logica viewer-ului
│   ├── md.js                   # adaptor Markdown (frontmatter + containere :::)
│   └── vendor/                 # markdown-it, highlight.js (locale)
└── presentations/
    ├── index.json              # lista directoarelor cu prezentări
    └── demo/                   # exemplu — poate fi șters sau înlocuit
```

## Pornire

Fișierele Markdown sunt încărcate prin `fetch()`, deci pagina trebuie servită printr-un server HTTP (nu deschisă direct cu `file://`):

```powershell
python -m http.server 8080
# sau
npx serve .
```

Apoi deschide **http://localhost:8080**.

## Embedding (folosirea motorului din alt repo)

Un repo de conținut are nevoie doar de prezentări + două pagini HTML subțiri care încarcă motorul de aici. Asset-urile se pot servi direct de pe GitHub prin [jsDelivr](https://www.jsdelivr.com/):

```
https://cdn.jsdelivr.net/gh/ovidiuchis/mdeck@main/assets/...
```

Structura unui repo de conținut:

```
repo-conținut/
├── index.html        # copie subțire — CSS/JS din CDN
├── deck.html         # copie subțire — CSS/JS din CDN
└── presentations/
    ├── index.json
    └── prezentarea-mea/...
```

În `deck.html` și `index.html` din repo-ul de conținut se înlocuiesc referințele locale `assets/...` cu URL-urile CDN și, opțional, se setează configurarea **înainte** de scripturile motorului:

```html
<script>
  window.MDECK = {
    root: "presentations/",   // directorul cu prezentări (implicit)
    home: "index.html",       // pagina de start (implicit)
    author: "Nume Prenume",   // semnătura de pe primul/ultimul slide (implicit: fără)
    monogram: "NP"            // monograma semnăturii (implicit: inițialele autorului)
  };
</script>
<script src="https://cdn.jsdelivr.net/gh/ovidiuchis/mdeck@main/assets/deck.js"></script>
```

Exemplu complet de repo de conținut: [oc-prezentari](https://github.com/ovidiuchis/oc-prezentari).

> **Notă:** jsDelivr cache-uiește `@main` până la 12 ore. Pentru versiuni stabile, referă un tag sau un commit: `...@v1.0/assets/...`.

Alternative la CDN: includerea acestui repo ca **git submodule** (referințe relative `mdeck/assets/...`) sau pur și simplu **copierea** directorului `assets/`.

## Cum adaugi o prezentare nouă

1. Creează un director nou în `presentations/`, de ex. `presentations/intro-git/`.
2. Adaugă un `presentation.json`:

```json
{
  "title": "Introducere în Git",
  "description": "Versionare de cod pentru începători.",
  "accent": "violet",
  "tags": ["Git", "Curs"],
  "slides": ["01-titlu.md", "02-concepte.md", "03-final.md"]
}
```

3. Scrie slide-urile ca fișiere `.md` (vezi sintaxa mai jos).
4. Adaugă numele directorului în `presentations/index.json`.

Gata — apare automat pe pagina de start.

## Sintaxa unui slide

Un slide = un fișier Markdown, opțional cu frontmatter:

```markdown
---
layout: title        # title | section | center | default
accent: indigo       # teal | indigo | violet | amber | rose | emerald | sky
---

###### Eticheta mică de deasupra (eyebrow)

## Titlul slide-ului

Text obișnuit, **bold**, *italic*, `cod inline`, [linkuri](https://...).

- liste cu buline
1. liste numerotate

> Citate evidențiate

| Tabele | Suportate |
|--------|-----------|
| da     | desigur   |
```

### Blocuri de cod cu highlighting

````markdown
```sql
SELECT Nume, Oras FROM Clienti WHERE Oras = 'Cluj-Napoca';
```
````

Limbajele uzuale sunt incluse (sql, js/ts, python, bash, powershell, json, html, css, c#, java...); pentru altele, descarcă fișierul limbajului din highlight.js în `assets/vendor/languages/` și include-l în `deck.html`.

### Containere pentru layout (grile, carduri, statistici)

```markdown
::: grid 3
::: card teal
### Titlu card
Conținutul cardului.
:::
::: card indigo
### Alt card
- merge și cu liste
:::
::: stat violet
## 250+
Eticheta statisticii
:::
:::
```

`grid 2|3|4` creează coloane; `card <accent>` un card colorat; `stat <accent>` un număr mare cu etichetă. Fiecare `:::` gol închide containerul curent.

## Navigare în prezentare

| Tastă / gest | Acțiune |
|--------------|---------|
| `→` `↓` `Space` `PgDn` / click | slide următor |
| `←` `↑` `PgUp` | slide anterior |
| `Home` / `End` | primul / ultimul slide |
| `F` | ecran complet |
| `H` | înapoi la lista de prezentări (Home) |
| `D` | comută tema închisă / deschisă (memorată în browser) |
| `G` sau `O` | vedere de ansamblu (grilă cu toate slide-urile) |
| `Esc` | închide vederea de ansamblu |
| swipe stânga/dreapta | navigare pe touch |

Fiecare slide are URL propriu (`deck.html?p=demo#3`) — poți trimite link direct către un slide.

## Tipărire / export PDF

Deschide prezentarea și folosește *Print → Save as PDF* din browser — fiecare slide se așază pe propria pagină.
