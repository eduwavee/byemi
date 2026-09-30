# Byemi — Control de Uñas (PWA)

PWA a medida para el control diario de ingresos de un salon de unas. Registro de ingresos por dia, con porcentajes de reparto configurables entre profesionales.

## Funcionalidades

• Registro diario de ingresos y gastos, con lista de precios que completa el monto
• Reparto configurable por profesional (porcentajes)
• Resumen/estadisticas de lo cobrado
• Agenda semanal con horarios libres y seña por turno
• Fichas de clientas: WhatsApp, servicio habitual, notas, cumpleaños, fotos y ranking
• Avisos por WhatsApp: recordatorio de turno, service vencido y cumpleaños
• Clave de acceso y backup (CSV para Excel + JSON completo)

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

## Deploy del backend

• APP_PASSWORD (opcional): clave inicial. Si no se define, la app pide crear una la primera vez que se abre.
• DATA_DIR: carpeta donde se guardan la base SQLite y las fotos de clientas (subcarpeta photos/). Tiene que ser un disco persistente.

## Notas

Proyecto real hecho a medida para un cliente (salon de unas), desarrollado en solitario de punta a punta: relevamiento, arquitectura, desarrollo, despliegue y soporte. Deploy en produccion: byemi.vercel.app
