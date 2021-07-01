import * as React from "react";
import {
  Transaction,
  IDappProvider,
  Address,
  TransactionHash,
  Nonce,
} from "@elrondnetwork/erdjs";
import ledgerErrorCodes from "helpers/ledgerErrorCodes";
import { useContext } from "context";
import SignWithLedgerModal from "./SignWithLedgerModal";
import { getProviderType, walletSign, useSearchTransactions } from "./helpers";
import { useRefreshAccount } from "helpers/accountMethods";
import { RawTransactionType } from "helpers/types";
import { useHistory } from "react-router-dom";
import { updateSendStatus } from "helpers/useSendTransactions";

interface SignTransactionsType {
  transactions: Transaction[];
  callbackRoute: string;
}

export default function SendTransactions() {
  const history = useHistory();
  const [showSignModal, setShowSignModal] = React.useState(false);
  const [txHash, setTxHash] = React.useState<TransactionHash>(
    new TransactionHash("")
  );
  const [newTransactions, setNewTransactions] = React.useState<Transaction[]>();
  const [newCallbackRoute, setNewCallbackRoute] = React.useState("");
  const [error, setError] = React.useState("");
  const context = useContext();
  const { dapp, address, network } = context;
  const refreshAccount = useRefreshAccount();

  useSearchTransactions();

  const provider: IDappProvider = dapp.provider;

  const providerType = getProviderType(provider);

  const handleClose = () => {
    const callbackRoute = newCallbackRoute;
    setNewTransactions(undefined);
    setNewCallbackRoute("");
    setError("");
    setShowSignModal(false);
    updateSendStatus({ loading: false, status: "cancelled" });
  };

  const send = (e: CustomEvent) => {
    if (e.detail && "transactions" in e.detail && "callbackRoute" in e.detail) {
      const { transactions, callbackRoute } = e.detail;
      signTransactions({ transactions, callbackRoute });
    }
  };

  React.useEffect(() => {
    document.addEventListener("transactions", send);
    return () => {
      document.removeEventListener("transactions", send);
    };
  }, [context]);

  const signTransactions = ({
    transactions,
    callbackRoute,
  }: SignTransactionsType) => {
    const showError = (e: string) => {
      setShowSignModal(true);
      setError(e);
    };
    setNewCallbackRoute(callbackRoute);
    updateSendStatus({ loading: true });
    if (provider) {
      dapp.proxy
        .getAccount(new Address(address))
        .then((account) => {
          transactions.forEach((tx, i) => {
            tx.setNonce(new Nonce(account.nonce.valueOf() + i));
          });
          switch (providerType) {
            case "wallet":
              walletSign({
                transactions,
                callbackRoute,
                walletAddress: `${network.walletAddress}`,
              });
              break;
            case "ledger":
              setNewTransactions(transactions);
              setShowSignModal(true);
              break;
          }
        })
        .catch((e) => {
          updateSendStatus({ loading: false, status: "cancelled" });
          showError(e);
        });
    } else {
      setShowSignModal(true);
      setError(
        "You need a singer/valid signer to send a transaction, use either WalletProvider, LedgerProvider or WalletConnect"
      );
    }
  };

  const sendProps = {
    handleClose,
    error,
    setError,
    show: showSignModal,
    transactions: newTransactions || [],
    providerType,
    callbackRoute: newCallbackRoute,
  };

  return <SignWithLedgerModal {...sendProps} />;
}
