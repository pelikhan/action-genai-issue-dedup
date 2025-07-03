# Dédupliqueur Continu d'Incidents

Cette action est conçue pour trouver des problèmes en double dans un dépôt GitHub à l'aide d'un modèle GenAI. Elle récupère le problème actuel et le compare aux autres problèmes du dépôt, en tirant parti du raisonnement LLM pour déterminer s'ils sont des doublons.

> \[!NOTE]
> Cette action utilise les [GitHub Models](https://github.com/models) pour l'inférence LLM.

* [Français](./README.fr.md)
* [Espagnol](./README.es.md)

## Algorithme

L'algorithme de déduplication implémenté dans `genaisrc/action.genai.mts` fonctionne comme suit :

* **Récupération des problèmes** : Le script récupère le problème actuel et un ensemble configurable d'autres problèmes depuis le dépôt, filtrés selon l'état, les labels, la date de création et le nombre. Le problème courant est exclu de l'ensemble de comparaison.

* **Détection par lots avec un petit LLM** : Pour chaque groupe de problèmes, le script construit un prompt qui définit le problème actuel et le groupe des autres problèmes (groupés pour tenir dans la fenêtre de contexte). Le prompt demande au **petit** LLM de comparer le problème courant à chaque candidat et de fournir une sortie CSV avec le numéro du problème, le raisonnement, et un verdict (`DUP` pour doublon, `UNI` pour unique).

* **Validation d'un seul doublon avec un grand LLM** : Si le LLM identifie des doublons, le script lance un prompt de validation à l'aide d'un **grand** modèle pour confirmer le doublon détecté.

* **Sortie des résultats** : Si des doublons sont trouvés, leurs numéros et titres sont affichés. Si aucun doublon n'est trouvé, l'action est annulée avec un message approprié.

## Entrées

* `count` : Nombre de problèmes à vérifier pour les doublons (défaut : `30`)

* `since` : Ne vérifier que les problèmes créés après cette date (format ISO 8601)

* `labels` : Liste des labels pour filtrer les problèmes

* `state` : État des problèmes à vérifier (open, closed, all) (défaut : `open`)

* `max_duplicates` : Nombre maximum de doublons à vérifier (défaut : `3`)

* `tokens_per_issue` : Nombre de jetons à utiliser pour chaque problème lors de la vérification des doublons (défaut : `1000`)

* `label_as_duplicate` : Ajouter le label `duplicate` aux problèmes identifiés comme doublons (défaut : `false`)

* `github_token` : Jeton GitHub avec la permission `models: read` au minimum ([https://microsoft.github.io/genaiscript/reference/github-actions/#github-models-permissions](https://microsoft.github.io/genaiscript/reference/github-actions/#github-models-permissions)). (obligatoire)

* `debug` : Activer les logs de debug ([https://microsoft.github.io/genaiscript/reference/scripts/logging/](https://microsoft.github.io/genaiscript/reference/scripts/logging/)).

## Utilisation

Ajoutez ce qui suit à votre étape dans votre fichier de workflow :

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
Nous recommandons de mettre à jour les métadonnées du script plutôt que de modifier directement les fichiers de l'action.

* les entrées de l'action sont déduites des paramètres du script
* les sorties de l'action sont déduites du schéma de sortie du script
* la description de l'action est le titre du script
* la description du readme est celle du script
* le branding de l'action est celui du script

Pour **régénérer** les fichiers d'action (`action.yml`), exécutez :

```bash
npm run configure
```

Pour vérifier le lint des fichiers script, exécutez :

```bash
npm run lint
```

Pour effectuer une vérification de types sur les scripts, exécutez :

```bash
npm run typecheck
```

Pour construire l'image Docker localement, exécutez :

```bash
npm run docker:build
```

Pour lancer l'action localement dans Docker (après construction), utilisez :

```bash
npm run docker:start
```

Pour lancer l'action avec [act](https://nektosact.com/), installez d'abord le CLI act :

```bash
npm run act:install
```

Ensuite, vous pouvez lancer l'action avec :

```bash
npm run act
```

## Mise à jour

La version de GenAIScript est figée dans le fichier `package.json`. Pour la mettre à jour, exécutez :

```bash
npm run upgrade
```

## Release

Pour publier une nouvelle version de cette action, lancez le script de release sur un répertoire de travail propre.

```bash
npm run release
```
