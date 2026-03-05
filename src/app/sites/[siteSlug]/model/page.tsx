"use client";

import dynamic from "next/dynamic";
import { CHEMICAL_PLANT_ASSETS } from "@/data/chemical-plant-assets";

const Plant3DView = dynamic(() => import("@/components/canon/Plant3DView"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
      <div className="text-gray-400">Loading 3D view...</div>
    </div>
  ),
});

export default function ModelPage() {
  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">3D Plant Model</h1>
          <p className="text-sm text-gray-500">Interactive reconstruction visualization</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">
            Reset View
          </button>
          <button className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">
            Toggle Gaps
          </button>
          <button className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">
            Export
          </button>
        </div>
      </div>

      {/* 3D View */}
      <div className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100">
        <Plant3DView assets={CHEMICAL_PLANT_ASSETS} />
      </div>
    </div>
  );
}
