export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <p className="text-sm font-black uppercase tracking-[0.28em] text-[#f5a623]">Africa&apos;s prediction market</p>
      <h1 className="mt-4 font-display text-6xl font-black leading-none text-white">
        What happens in Africa, settles on Àgbà.
      </h1>

      <div className="mt-12 space-y-10 text-lg leading-8 text-white/70">
        <div>
          <h2 className="mb-3 font-display text-2xl font-black text-white">What is Àgbà?</h2>
          <p>
            Àgbà is a prediction market built entirely around African news. Every market on this platform started as a headline from a Nigerian or pan-African outlet — and every outcome is something that will actually happen, or not, within days or weeks.
          </p>
        </div>

        <div>
          <h2 className="mb-3 font-display text-2xl font-black text-white">How do markets get created?</h2>
          <p>
            An AI agent reads African news sources continuously. When it finds a story with a clear, verifiable outcome — a central bank decision, an election result, a match score, a currency crossing a threshold — it turns it into a YES/NO market automatically. No human has to approve it. No editorial bias. If the news is real and the outcome is checkable, a market exists.
          </p>
        </div>

        <div>
          <h2 className="mb-3 font-display text-2xl font-black text-white">How do you bet?</h2>
          <p>
            Connect a wallet, pick a market, choose YES or NO, and commit your USDC. The odds shift in real time as more people bet. You are not betting against the house — you are betting against other people who think you are wrong.
          </p>
        </div>

        <div>
          <h2 className="mb-3 font-display text-2xl font-black text-white">How do markets resolve?</h2>
          <p>
            Currency markets resolve automatically using live exchange rate data. Sports results are pulled from official match records. Everything else — politics, security, economy — is reviewed and resolved manually against public evidence. No market closes without a verifiable reason.
          </p>
        </div>

        <div>
          <h2 className="mb-3 font-display text-2xl font-black text-white">Why Africa?</h2>
          <p>
            African markets move fast and are under-represented in global prediction platforms. The naira, ECOWAS elections, AFCON qualifiers, central bank policy — these things matter to hundreds of millions of people and deserve real price discovery. Àgbà exists to provide that.
          </p>
        </div>
      </div>

      <div className="mt-14 border-t border-white/10 pt-10">
        <p className="text-sm text-white/35">
          Àgbà runs on Arc — a chain where USDC is the native currency, so there is no gas token to buy and no wrapped asset to manage. You bet with USDC, you win USDC.
        </p>
      </div>
    </main>
  );
}
