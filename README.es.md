Esta acción está diseñada para encontrar incidencias duplicadas en un repositorio de GitHub utilizando un modelo GenAI. Recupera la incidencia actual y la compara con otras incidencias del repositorio, aprovechando el razonamiento del LLM para determinar si son duplicados.

> \[!NOTA]
> Esta acción utiliza los [GitHub Models](https://github.com/models) para la inferencia del LLM.

## Algoritmo

El algoritmo de desduplicado implementado en `genaisrc/action.genai.mts` funciona de la siguiente manera:

* **Recuperación de incidencias**: El script recupera la incidencia actual y un conjunto configurable de otras incidencias del repositorio, filtradas por estado, etiquetas, fecha de creación y cantidad. La incidencia actual se excluye del conjunto de comparación.

* **Detección por lotes usando LLM pequeño**: Para cada grupo de incidencias, el script construye un prompt que define la incidencia actual y el grupo de otras incidencias (agrupadas para ajustarse a la ventana de contexto). El prompt instruye al LLM **pequeño** a comparar la incidencia actual con cada candidata, proporcionando una salida en CSV con el número de la incidencia, razonamiento y un veredicto (`DUP` para duplicada, `UNI` para única).

* **Validación individual de duplicados usando LLM grande**: Si el LLM identifica duplicados, el script ejecuta un prompt de validación LLM usando un modelo **grande** para confirmar el hallazgo de duplicado.

* **Salida de resultados**: Si se encuentran duplicados, se muestran sus números de incidencia y títulos. Si no se encuentran duplicados, la acción se cancela con un mensaje apropiado.

## Entradas

* `count`: Número de incidencias a comprobar por duplicados (por defecto: `30`)

* `since`: Solo comprobar incidencias creadas después de esta fecha (formato ISO 8601)

* `labels`: Lista de etiquetas para filtrar las incidencias

* `state`: Estado de las incidencias a comprobar (open, closed, all) (por defecto: `open`)

* `max_duplicates`: Número máximo de duplicados a comprobar (por defecto: `3`)

* `tokens_per_issue`: Número de tokens a usar para cada incidencia al comprobar duplicados (por defecto: `1000`)

* `label_as_duplicate`: Añade la etiqueta `duplicate` a las incidencias que se encuentran duplicadas (por defecto: `false`)

* `github_token`: Token de GitHub con al menos permiso `models: read` ([https://microsoft.github.io/genaiscript/reference/github-actions/#github-models-permissions](https://microsoft.github.io/genaiscript/reference/github-actions/#github-models-permissions)). (requerido)

* `debug`: Habilitar el logging de depuración ([https://microsoft.github.io/genaiscript/reference/scripts/logging/](https://microsoft.github.io/genaiscript/reference/scripts/logging/)).

## Uso

Agrega lo siguiente a tu paso en el archivo de flujo de trabajo:

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

Guarda este archivo bajo `.github/workflows/genai-issue-dedup.yml` en tu repositorio:

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

Esta acción fue generada automáticamente por GenAIScript a partir de los metadatos del script.
Recomendamos actualizar los metadatos del script en vez de editar directamente los archivos de la acción.

* las entradas de la acción se infieren de los parámetros del script
* las salidas de la acción se infieren del esquema de salida del script
* la descripción de la acción es el título del script
* la descripción del readme es la descripción del script
* el branding de la acción es el branding del script

Para **regenerar** los archivos de la acción (`action.yml`), ejecuta:

```bash
npm run configure
```

Para hacer lint de los archivos del script, ejecuta:

```bash
npm run lint
```

Para comprobar los tipos de los scripts, ejecuta:

```bash
npm run typecheck
```

Para construir la imagen de Docker localmente, ejecuta:

```bash
npm run docker:build
```

Para ejecutar la acción localmente en Docker (constrúyela primero), usa:

```bash
npm run docker:start
```

Para ejecutar la acción usando [act](https://nektosact.com/), primero instala el CLI de act:

```bash
npm run act:install
```

Luego, puedes ejecutar la acción con:

```bash
npm run act
```

## Actualizar

La versión de GenAIScript está fijada en el archivo `package.json`. Para actualizarla, ejecuta:

```bash
npm run upgrade
```

## Lanzamiento

Para lanzar una nueva versión de esta acción, ejecuta el script de lanzamiento en un directorio de trabajo limpio.

```bash
npm run release
```
