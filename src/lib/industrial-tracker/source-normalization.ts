export function canonicalSourceName(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();

  switch (normalized) {
    case "usaspending":
    case "usaspending.gov":
      return "USAspending";
    case "epa frs":
    case "epa facility registry service":
      return "EPA FRS";
    case "epa echo":
    case "epa-echo":
      return "EPA ECHO";
    case "sec edgar":
    case "sec-edgar":
      return "SEC EDGAR";
    case "eia":
      return "EIA";
    case "eia grid monitor":
      return "EIA Grid Monitor";
    case "queued up interconnection queue":
      return "Queued Up Interconnection Queue";
    case "empire state development incentives":
    case "new york esd incentives":
      return "Empire State Development Incentives";
    case "texas strategic projects":
    case "texas governor strategic projects":
      return "Texas Strategic Projects";
    case "michigan strategic projects":
    case "michigan medc projects":
      return "Michigan Strategic Projects";
    case "arizona strategic projects":
    case "arizona commerce projects":
      return "Arizona Strategic Projects";
    case "arkansas strategic projects":
    case "arkansas aedc projects":
      return "Arkansas Strategic Projects";
    case "ohio strategic projects":
    case "ohio jobs projects":
      return "Ohio Strategic Projects";
    case "georgia strategic projects":
    case "georgia governor strategic projects":
      return "Georgia Strategic Projects";
    case "north carolina strategic projects":
    case "north carolina commerce projects":
      return "North Carolina Strategic Projects";
    case "tennessee strategic projects":
    case "tennessee ecd projects":
      return "Tennessee Strategic Projects";
    case "south carolina strategic projects":
    case "south carolina commerce projects":
      return "South Carolina Strategic Projects";
    case "kentucky strategic projects":
    case "kentucky ced projects":
      return "Kentucky Strategic Projects";
    case "virginia strategic projects":
    case "virginia vedp projects":
      return "Virginia Strategic Projects";
    case "indiana strategic projects":
    case "indiana iedc projects":
      return "Indiana Strategic Projects";
    case "alabama strategic projects":
    case "alabama commerce projects":
      return "Alabama Strategic Projects";
    case "louisiana strategic projects":
    case "louisiana led projects":
      return "Louisiana Strategic Projects";
    case "mississippi strategic projects":
    case "mississippi mda projects":
      return "Mississippi Strategic Projects";
    case "illinois strategic projects":
    case "illinois edc projects":
      return "Illinois Strategic Projects";
    case "missouri strategic projects":
    case "missouri ded projects":
      return "Missouri Strategic Projects";
    case "kansas strategic projects":
    case "kansas commerce projects":
      return "Kansas Strategic Projects";
    case "oklahoma strategic projects":
    case "oklahoma commerce projects":
      return "Oklahoma Strategic Projects";
    case "west virginia strategic projects":
    case "west virginia economic development projects":
      return "West Virginia Strategic Projects";
    case "iowa strategic projects":
    case "iowa ieda projects":
      return "Iowa Strategic Projects";
    case "new jersey strategic projects":
    case "new jersey njeda projects":
      return "New Jersey Strategic Projects";
    case "pennsylvania strategic projects":
    case "pennsylvania dced projects":
      return "Pennsylvania Strategic Projects";
    case "maryland strategic projects":
    case "maryland commerce projects":
      return "Maryland Strategic Projects";
    case "new mexico strategic projects":
    case "new mexico edd projects":
      return "New Mexico Strategic Projects";
    case "nevada strategic projects":
    case "nevada governor strategic projects":
      return "Nevada Strategic Projects";
    case "utah strategic projects":
    case "utah goeo projects":
      return "Utah Strategic Projects";
    case "idaho strategic projects":
    case "idaho commerce projects":
      return "Idaho Strategic Projects";
    case "nebraska strategic projects":
    case "nebraska ded projects":
      return "Nebraska Strategic Projects";
    case "california strategic projects":
    case "california gobiz projects":
      return "California Strategic Projects";
    case "florida strategic projects":
    case "florida governor projects":
      return "Florida Strategic Projects";
    case "colorado strategic projects":
    case "colorado governor projects":
      return "Colorado Strategic Projects";
    case "washington strategic projects":
    case "washington commerce projects":
      return "Washington Strategic Projects";
    case "oregon strategic projects":
    case "oregon business projects":
      return "Oregon Strategic Projects";
    case "chips awards":
      return "CHIPS Awards";
    case "doe edf projects":
      return "DOE EDF Projects";
    case "baseload private capex feed":
    case "private capital feed":
      return "Baseload private capex feed";
    case "baseload private capital market feed":
      return "Baseload private capital market feed";
    case "baseload private infrastructure financing feed":
    case "private infrastructure financing feed":
      return "Baseload private infrastructure financing feed";
    case "baseload private manufacturing equity debt feed":
    case "private manufacturing equity debt feed":
      return "Baseload private manufacturing equity debt feed";
    case "baseload private transmission financing feed":
    case "private transmission financing feed":
      return "Baseload private transmission financing feed";
    case "baseload private water thermal financing feed":
    case "private water thermal financing feed":
      return "Baseload private water thermal financing feed";
    case "baseload private onsite power financing feed":
    case "private onsite power financing feed":
      return "Baseload private onsite power financing feed";
    case "baseload private industrial real estate financing feed":
    case "private industrial real estate financing feed":
      return "Baseload private industrial real estate financing feed";
    case "baseload private fuel logistics financing feed":
    case "private fuel logistics financing feed":
      return "Baseload private fuel logistics financing feed";
    case "baseload private rail logistics financing feed":
    case "private rail logistics financing feed":
      return "Baseload private rail logistics financing feed";
    case "baseload private circular industry financing feed":
    case "private circular industry financing feed":
      return "Baseload private circular industry financing feed";
    case "baseload private grid resilience financing feed":
    case "private grid resilience financing feed":
      return "Baseload private grid resilience financing feed";
    case "baseload private industrial communications financing feed":
    case "private industrial communications financing feed":
      return "Baseload private industrial communications financing feed";
    case "baseload private industrial steam financing feed":
    case "private industrial steam financing feed":
      return "Baseload private industrial steam financing feed";
    case "baseload private heavy equipment financing feed":
    case "private heavy equipment financing feed":
      return "Baseload private heavy equipment financing feed";
    case "baseload private waste heat recovery financing feed":
    case "private waste heat recovery financing feed":
      return "Baseload private waste heat recovery financing feed";
    case "baseload private industrial water rights financing feed":
    case "private industrial water rights financing feed":
      return "Baseload private industrial water rights financing feed";
    case "baseload private industrial cyber financing feed":
    case "private industrial cyber financing feed":
      return "Baseload private industrial cyber financing feed";
    case "baseload private industrial air separation financing feed":
    case "private industrial air separation financing feed":
      return "Baseload private industrial air separation financing feed";
    case "baseload private cooling infrastructure financing feed":
    case "private cooling infrastructure financing feed":
      return "Baseload private cooling infrastructure financing feed";
    case "baseload private materials handling financing feed":
    case "private materials handling financing feed":
      return "Baseload private materials handling financing feed";
    case "baseload private compressed air financing feed":
    case "private compressed air financing feed":
      return "Baseload private compressed air financing feed";
    case "baseload private industrial byproduct logistics financing feed":
    case "private industrial byproduct logistics financing feed":
      return "Baseload private industrial byproduct logistics financing feed";
    default:
      return String(value || "").trim() || "Unknown Source";
  }
}
