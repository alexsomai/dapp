import React from "react";
import { WalletConnectProvider } from "@elrondnetwork/erdjs";
import { useHistory } from "react-router-dom";
import { useContext, useDispatch } from "context";
import storage from "helpers/storage";
import useLogout from "helpers/useLogout";

interface InitWalletConnectType {
  callbackRoute: string;
  logoutRoute: string;
}

const ua = window.navigator.userAgent;
const iOS = !!ua.match(/iPad/i) || !!ua.match(/iPhone/i);
const webkit = !!ua.match(/WebKit/i);
const iOSSafari = iOS && webkit && !ua.match(/CriOS/i);

export default function useInitWalletConnect({
  callbackRoute,
  logoutRoute,
}: InitWalletConnectType) {
  let heartbeatDisconnectInterval: any;
  const heartbeatInterval = 15000;
  const { dapp, walletConnectBridge } = useContext();
  const logout = useLogout();

  const dispatch = useDispatch();
  const history = useHistory();

  const [error, setError] = React.useState<string>("");
  const [
    walletConnect,
    setWalletConnect,
  ] = React.useState<WalletConnectProvider>();

  const provider: any = dapp.provider;

  React.useEffect(() => {
    heartbeat();
    const interval = setInterval(() => {
      heartbeat();
    }, heartbeatInterval);

    return () => clearInterval(interval);
  }, [provider]);

  React.useEffect(() => {
    return () => {
      if (
        provider &&
        "walletConnector" in provider &&
        provider.walletConnector.connected
      ) {
        window.addEventListener("storage", (e) => {
          if (e.key === "walletconnect") {
            handleOnLogout();
          }
        });
      }
    };
  });

  const heartbeat = () => {
    if (
      provider &&
      "walletConnector" in provider &&
      provider.walletConnector.connected &&
      !iOSSafari
    ) {
      provider
        .sendCustomMessage({
          method: "heartbeat",
          params: {},
        })
        .then(() => {})
        .catch((e: any) => {
          console.error("Connection lost", e);
          handleOnLogout();
        });
    }
  };

  const handleOnLogin = () => {
    const provider: any = dapp.provider;
    provider
      .getAddress()
      .then((address: string) => {
        const loggedIn = !!storage.local.getItem("loginMethod");
        if (!loggedIn) {
          history.push(callbackRoute);
        }
        provider.getSignature().then((signature: string) => {
          if (signature) {
            const tokenLogin = storage.session.getItem("tokenLogin");
            const loginToken =
              tokenLogin && "loginToken" in tokenLogin
                ? tokenLogin.loginToken
                : "";

            dispatch({
              type: "setTokenLogin",
              tokenLogin: {
                loginToken,
                signature,
              },
            });
          }
        });
        dispatch({
          type: "setWalletConnectLogin",
          walletConnectLogin: {
            loginType: "walletConnect",
            callbackRoute,
            logoutRoute,
          },
        });
        dispatch({ type: "login", address, loginMethod: "walletconnect" });

        provider.walletConnector.on("heartbeat", () => {
          clearInterval(heartbeatDisconnectInterval);
          heartbeatDisconnectInterval = setInterval(() => {
            console.log("Maiar Wallet Connection Lost");
            handleOnLogout();
            clearInterval(heartbeatDisconnectInterval);
          }, 150000);
        });
      })
      .catch((e: any) => {
        setError("Invalid address");
        console.log(e);
      });
  };

  const handleOnLogout = () => {
    if (!!storage.local.getItem("loginMethod")) {
      history.push(logoutRoute);
    }
    logout({ callbackUrl: `${window.location.origin}${logoutRoute}` });
  };

  const walletConnectInit = () => {
    const provider = new WalletConnectProvider(
      dapp.proxy,
      walletConnectBridge,
      {
        onClientLogin: handleOnLogin,
        onClientLogout: handleOnLogout,
      }
    );
    dispatch({ type: "setProvider", provider });
    dapp.provider = provider;
    setWalletConnect(provider);
  };

  return {
    error,
    walletConnectInit,
    walletConnect,
  };
}
