# Byemi — Control de Uñas (PWA)

PWA a medida para el control diario de ingresos de un salon de unas. Registro de ingresos por dia, con porcentajes de reparto configurables entre profesionales.

## Funcionalidades

• Registro diario de ingresos
• Reparto configurable por profesional (porcentajes)
• Resumen/estadisticas de lo cobrado

## Stack

• Frontend: React + Vite
• Backend: Node.js + Express
• Base de datos: SQLite (better-sqlite3)

## Estructura

• frontend/ — app React (Vite)
• backend/ — API REST (Express + SQLite)

## Como correrlo

Backend:

cd backend
npm install
npm run dev

Frontend:

cd frontend
npm install
npm run dev

## Notas

Proyecto real hecho a medida para un cliente (salon de unas), desarrollado en solitario de punta a punta: relevamiento, arquitectura, desarrollo, despliegue y soporte. Deploy en produccion: byemi.vercel.app
