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

## Ajustar agujeros
Las coordenadas están en `lib/ocarinaModel.ts` (viewBox 0 0 481 336).
Si reemplazás `public/ocarina.png`, recalibrá `cx/cy/r`.

## Agujeros traseros
En esta versión se toman `B1` y `B2` como “back holes” (pulgares), tal como indicaste.
