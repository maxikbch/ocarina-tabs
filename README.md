# Ocarina Tabs (Prototype)

Prototipo en Next.js para armar secuencias de digitación (agujeros tapados) sobre un PNG de ocarina.

## Requisitos
- Node 18+ (recomendado 20+)

## Instalar y correr
```bash
npm install
npm run dev
```

Abrí http://localhost:3000

## App de escritorio (Electron)

Para ejecutar la app como ventana de escritorio (sin servidor):

```bash
npm run build          # genera la carpeta out/ (export estático)
npm run electron       # abre la ventana de Electron cargando out/
```

Para generar instaladores y ejecutables:

```bash
npm run build:app      # hace next build y luego electron-builder
```

Los artefactos quedan en `release/`:

- **Windows:** `release/Ocarina Tabs Setup 0.1.0.exe` (instalador NSIS) y `release/Ocarina Tabs 0.1.0.exe` (portable).
- **macOS:** ejecutá `npm run build:app` en macOS; se genera `release/Ocarina Tabs 0.1.0.dmg`.
- **Linux:** ejecutá `npm run build:app` en Linux; se genera un AppImage en `release/`.

En Windows la firma de código está desactivada (`signAndEditExecutable: false`) para que el build funcione sin privilegios de enlaces simbólicos; el instalador y el portable son igualmente usables.

## Ajustar agujeros
Las coordenadas están en `lib/ocarinaModel.ts` (viewBox 0 0 481 336).
Si reemplazás `public/ocarina.png`, recalibrá `cx/cy/r`.

## Agujeros traseros
En esta versión se toman `B1` y `B2` como “back holes” (pulgares), tal como indicaste.
