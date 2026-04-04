import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import PlantDetail from './components/PlantDetail';
import AddPlant from './components/AddPlant';
import AlertsPage from './components/AlertsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="plant/:id" element={<PlantDetail />} />
        <Route path="add" element={<AddPlant />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
