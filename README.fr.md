# Déduplication Continue des Problèmes

Cette action est conçue pour trouver des problèmes en double dans un dépôt GitHub en utilisant un modèle GenAI. Elle récupère le problème actuel et le compare à d'autres problèmes dans le dépôt, en utilisant le raisonnement LLM pour déterminer s'ils sont en double.

> \[!NOTE]
> Cette action utilise [GitHub Models](https://github.com/models) pour l'inférence LLM.

## Algorithme

L'algorithme de déduplication implémenté dans `genaisrc/action.genai.mts` fonctionne comme suit :

* **Classification des Étiquettes (Mode Auto)** : Lorsque `labels` est défini sur `auto`, le script récupère d'abord toutes les étiquettes du dépôt et utilise un **petit** LLM pour classifier le problème actuel par rapport à ces étiquettes. Les étiquettes classifiées sont ensuite utilisées pour filtrer les problèmes à l'étape suivante.

* **Récupération des Problèmes** : Le script récupère le problème actuel et un ensemble configurable d'autres problèmes du dépôt, filtrés par état, étiquettes (ou étiquettes auto-classifiées), date de création et nombre. Le problème actuel est exclu de l'ensemble de comparaison.

* **Détection par lot utilisant un petit LLM** : Pour chaque groupe de problèmes, le script construit une invite qui définit le problème actuel et le groupe d'autres problèmes (groupés pour tenir dans la fenêtre contextuelle). L'invite demande au **petit** LLM de comparer le problème actuel à chaque candidat, fournissant une sortie CSV avec le numéro du problème, le raisonnement et un verdict (`DUP` pour doublon, `UNI` pour unique).

* **Validation d'un seul doublon avec un grand LLM** : Si le LLM identifie des doublons, le script exécute une invite de validation LLM en utilisant un modèle **grand** pour confirmer la correspondance des doublons.

* **Sortie des Résultats** : Si des doublons sont trouvés, leurs numéros et titres sont affichés. Si aucun doublon n'est trouvé, l'action est annulée avec un message approprié.

## Entrées

* `count` : Nombre de problèmes à vérifier pour les doublons (par défaut : `30`)

* `since` : Vérifier uniquement les problèmes créés après cette date (format ISO 8601)

* `labels` : Liste des étiquettes pour filtrer les problèmes, ou `auto` pour classifier automatiquement le problème et utiliser ces étiquettes

* `state` : État des problèmes à vérifier (ouvert, fermé, tous) (par défaut : `ouvert`)

* `max_duplicates` : Nombre maximal de doublons à vérifier (par défaut : `3`)

* `tokens_per_issue` : Nombre de tokens à utiliser pour chaque problème lors de la vérification des doublons (par défaut : `1000`)

* `label_as_duplicate` : Ajouter l'étiquette `duplicate` aux problèmes identifiés comme doublons (par défaut : `false`)

* `github_token` : Jeton GitHub avec au moins les permissions `models: read` (<https://microsoft.github.io/genaiscript/reference/github-actions/#github-models-permissions>). (requis)

* `debug` : Activer la journalisation de débogage (<https://microsoft.github.io/genaiscript/reference/scripts/logging/>).

## Utilisation

Ajoutez ce qui suit à votre étape dans votre fichier workflow :

```yaml
---
permissions:
  models: read
  issues: write
---
steps:
  - uses: pelikhan/action-genai-issue-dedup@v0
    with:
      github_token: ${{ secrets.GITHUB_TOKEN }}
```

## Exemple

Enregistrez ce fichier sous `.github/workflows/genai-issue-dedup.yml` dans votre dépôt :

```yaml
name: GenAI Find Duplicate Issues
on:
  issues:
    types: [opened, reopened]
permissions:
  models: read
  issues: write
concurrency:
  group: ${{ github.workflow }}-${{ github.event.issue.number }}
  cancel-in-progress: true
jobs:
  genai-issue-dedup:
    runs-on: ubuntu-latest
    steps:
      - name: Run action-issue-dedup Action
        uses: pelikhan/action-genai-issue-dedup@v0
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

## Développement

Cette action a été générée automatiquement par GenAIScript à partir des métadonnées du script.
Nous recommandons de mettre à jour les métadonnées du script plutôt que de modifier directement les fichiers d'action.

* les entrées de l'action sont déduites des paramètres du script
* les sorties de l'action sont déduites du schéma de sortie du script
* la description de l'action est le titre du script
* la description du README est la description du script
* le branding de l'action est le branding du script

Pour **régénérer** les fichiers d'action (`action.yml`), exécutez :

```bash
npm run configure
```

Pour lint les fichiers de script, exécutez :

```bash
npm run lint
```

Pour vérifier les types des scripts, exécutez :

```bash
npm run typecheck
```

Pour construire l'image Docker localement, exécutez :

```bash
npm run docker:build
```

Pour exécuter l'action localement dans Docker (construisez-la d'abord), utilisez :

```bash
npm run docker:start
```

Pour exécuter l'action en utilisant [act](https://nektosact.com/), installez d'abord l'interface en ligne de commande act :

```bash
npm run act:install
```

Ensuite, vous pouvez exécuter l'action avec :

```bash
npm run act
```

## Mise à niveau

La version de GenAIScript est épinglée dans le fichier `package.json`. Pour la mettre à niveau, exécutez :

```bash
npm run upgrade
```

## Publication

Pour publier une nouvelle version de cette action, exécutez le script de publication sur un répertoire de travail propre.

```bash
npm run release
```
