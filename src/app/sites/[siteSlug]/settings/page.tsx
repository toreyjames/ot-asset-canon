export default function SettingsPage() {
  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-bold text-gray-900">Site Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure site details and reconstruction parameters
        </p>
      </div>

      {/* Basic Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Site Name</label>
            <input
              type="text"
              defaultValue="Houston Plant"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              type="text"
              defaultValue="Houston, TX"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plant Type Override</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="">Auto-detect from data</option>
              <option value="petrochemical">Petrochemical</option>
              <option value="chemical">Chemical</option>
              <option value="refinery">Refinery</option>
              <option value="pharmaceutical">Pharmaceutical</option>
              <option value="manufacturing">General Manufacturing</option>
              <option value="automotive">Automotive</option>
              <option value="food">Food & Beverage</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Leave as auto-detect to infer plant type from asset patterns
            </p>
          </div>
        </div>
      </div>

      {/* Reconstruction Settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Reconstruction Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gap Detection Sensitivity</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="high">High - Flag all potential gaps</option>
              <option value="medium">Medium - Flag likely gaps</option>
              <option value="low">Low - Only flag definite gaps</option>
            </select>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm font-medium text-gray-900">Include inferred equipment</div>
              <div className="text-xs text-gray-500">Show equipment inferred from engineering logic</div>
            </div>
            <button className="w-12 h-6 bg-blue-600 rounded-full relative">
              <span className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
            </button>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm font-medium text-gray-900">Auto-dismiss resolved gaps</div>
              <div className="text-xs text-gray-500">Automatically close gaps when matching data is imported</div>
            </div>
            <button className="w-12 h-6 bg-gray-200 rounded-full relative">
              <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full" />
            </button>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 rounded-xl border border-red-200 p-6">
        <h2 className="text-lg font-semibold text-red-900 mb-4">Danger Zone</h2>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-red-900">Delete this site</div>
            <div className="text-xs text-red-700">Permanently delete all site data and assets</div>
          </div>
          <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg">
            Delete Site
          </button>
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-6 flex justify-end">
        <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg">
          Save Changes
        </button>
      </div>
    </div>
  );
}
