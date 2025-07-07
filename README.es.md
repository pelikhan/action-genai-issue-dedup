# Deduplicador Continuo de Problemas

Esta acción está diseñada para encontrar problemas duplicados en un repositorio de GitHub utilizando un modelo GenAI. Recupera el problema actual y lo compara con otros problemas en el repositorio, aprovechando el razonamiento de LLM para determinar si son duplicados.

> \[!NOTA]> Esta acción utiliza [Modelos de GitHub](https://github.com/models) para inferencia LLM.

## Algoritmo

El algoritmo de deduplicación implementado en `genaisrc/action.genai.mts` opera de la siguiente manera:

* **Recuperación de Problemas**: El script recupera el problema actual y un conjunto configurable de otros problemas del repositorio, filtrados por estado, etiquetas, fecha de creación y cantidad. El problema actual se excluye del conjunto de comparación.

* **Detección por lotes usando LLM pequeño**: Para cada grupo de problemas, el script construye un mensaje que define el problema actual y el grupo de otros problemas (agrupados para ajustarse a la ventana de contexto). El mensaje instruye al LLM **pequeño** a comparar el problema actual con cada candidato, proporcionando una salida en CSV con el número del problema, el razonamiento y un veredicto (`DUP` para duplicado, `UNI` para único).

* **Validación de duplicados individuales usando LLM grande**: Si el LLM identifica duplicados, el script ejecuta un mensaje de validación LLM usando un modelo **grande** para confirmar el problema duplicado.

* **Salida de Resultados**: Si se encuentran duplicados, se proporcionan los números de los problemas y sus títulos. Si no se encuentran duplicados, la acción se cancela con un mensaje apropiado.

## Entradas

* `count`: Número de problemas a comprobar como duplicados (por defecto: `30`)

* `since`: Solo comprobar problemas creados después de esta fecha (formato ISO 8601)

* `labels`: Lista de etiquetas para filtrar problemas

* `state`: Estado de los problemas a comprobar (abiertos, cerrados, todos) (por defecto: `open`)

* `max_duplicates`: Número máximo de duplicados a comprobar (por defecto: `3`)

* `tokens_per_issue`: Número de tokens a usar por cada problema al buscar duplicados (por defecto: `1000`)

* `label_as_duplicate`: Añadir la etiqueta `duplicado` a los problemas que se encuentren duplicados (por defecto: `false`)

* `github_token`: Token de GitHub con al menos permiso de `models: read` (<https://microsoft.github.io/genaiscript/reference/github-actions/#github-models-permissions>). (obligatorio)

* `debug`: Habilitar registro de depuración (<https://microsoft.github.io/genaiscript/reference/scripts/logging/>).

## Uso

Agregue lo siguiente a su paso en su archivo de flujo de trabajo:

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

## Ejemplo

Guarde este archivo en `.github/workflows/genai-issue-dedup.yml` en su repositorio:

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

## Desarrollo

Esta acción fue generada automáticamente por GenAIScript a partir de los metadatos del script. Recomendamos actualizar los metadatos del script en lugar de editar directamente los archivos de la acción.

* las entradas de la acción se infieren de los parámetros del script
* las salidas de la acción se infieren del esquema de salida del script
* la descripción de la acción es el título del script
* la descripción del readme es la descripción del script
* el branding de la acción es el branding del script

Para **regenerar** los archivos de la acción (`action.yml`), ejecute:

```bash
npm run configure
```

Para lintar los archivos de script, ejecute:

```bash
npm run lint
```

Para verificar el tipo de los scripts, ejecute:

```bash
npm run typecheck
```

Para construir la imagen de Docker localmente, ejecute:

```bash
npm run docker:build
```

Para ejecutar la acción localmente en Docker (construyéndola primero), use:

```bash
npm run docker:start
```

Para ejecutar la acción usando [act](https://nektosact.com/), primero instale la CLI de act:

```bash
npm run act:install
```

Luego, puede ejecutar la acción con:

```bash
npm run act
```

## Actualizar

La versión de GenAIScript está fijada en el archivo `package.json`. Para actualizarla, ejecute:

```bash
npm run upgrade
```

## Lanzamiento

Para lanzar una nueva versión de esta acción, ejecute el script de lanzamiento en un directorio de trabajo limpio.

```bash
npm run release
```
