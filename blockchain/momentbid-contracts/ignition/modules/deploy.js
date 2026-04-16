const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("MomentBidDeploy", (m) => {
  // Can be overridden via --parameters '{"platformWallet":"0x...","platformFeePercent":5}'
  const platformWallet = m.getParameter("platformWallet", m.getAccount(0));
  const platformFeePercent = m.getParameter("platformFeePercent", 5);

  const token = m.contract("MomentBidToken");
  const exclusionMgr = m.contract("ExclusionManager");
  const core = m.contract("MomentBidCore", [
    token,
    exclusionMgr,
    platformWallet,
    platformFeePercent,
  ]);
  const oracleCtrl = m.contract("OracleController", [core]);

  return { token, exclusionMgr, core, oracleCtrl };
});
