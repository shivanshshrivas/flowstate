import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const FullDeployModule = buildModule("FullDeploy", (m) => {
  const deployer = m.getAccount(0);
  const operator = m.getParameter("operator", deployer);
  const admin = m.getParameter("admin", deployer);
  const platformFeeWallet = m.getParameter("platformFeeWallet", deployer);

  // 1. Deploy FLUSD
  const flusd = m.contract("FLUSD", [deployer]);

  // 2. Deploy EscrowStateMachine
  const esm = m.contract("EscrowStateMachine", [deployer, operator, platformFeeWallet]);

  // 3. Deploy DisputeResolver
  const dr = m.contract("DisputeResolver", [deployer, operator, admin, esm]);

  // 4. Wire up: ESM must trust DisputeResolver to call executeResolution
  m.call(esm, "setDisputeResolver", [dr], { id: "setDisputeResolver" });

  return { flusd, esm, dr };
});

export default FullDeployModule;
