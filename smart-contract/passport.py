import smartpy as sp
from smartpy.templates import fa2_lib as fa2

# Import the FA2 base implementation
main = fa2.main


@sp.module
def my_module():
    import main

    # ------------------------------------------------------------
    # Define the structure of a "Passport"
    # This is NOT token metadata — this is custom interactive state
    # ------------------------------------------------------------
    t_passport: type = sp.record(
        spine_color=sp.string,       # hex color for the passport spine (e.g. "#000000")
        stamps=sp.list[sp.string],   # list of stamp strings (emoji or text)
    )

    # ------------------------------------------------------------
    # FA2 NFT Contract with custom interactive behaviour
    # ------------------------------------------------------------
    class PassportNFTContract(
        main.Admin,                # admin permissions
        main.Nft,                  # FA2 NFT base
        main.MintNft,              # minting logic (template-provided, admin-gated if used)
        main.BurnNft,              # burning logic
        main.OnchainviewBalanceOf  # balance view
    ):
        def __init__(self, admin_address, contract_metadata, ledger, token_metadata):
            # Initialize FA2 mixins (order matters)
            main.OnchainviewBalanceOf.__init__(self)
            main.BurnNft.__init__(self)
            main.MintNft.__init__(self)
            main.Nft.__init__(self, contract_metadata, ledger, token_metadata)
            main.Admin.__init__(self, admin_address)

            # ----------------------------------------------------
            # Custom storage for the passport state
            # ----------------------------------------------------
            self.data.passports = sp.big_map()        # token_id -> passport state
            self.data.next_token_id = sp.nat(0)       # auto-increment token id
            self.data.max_supply = sp.nat(20)         # hard mint limit
            self.data.mint_price = sp.mutez(100000)   # 0.1ꜩ

        # --------------------------------------------------------
        # Issue (mint) a new passport NFT
        # --------------------------------------------------------
        @sp.entrypoint
        def mint_passport(self):
            # Enforce total supply cap and mint price
            assert self.data.next_token_id < self.data.max_supply
            assert sp.amount == self.data.mint_price

            # Assign a new token ID
            token_id = self.data.next_token_id
            self.data.next_token_id += 1

            # Record ownership in FA2 ledger
            self.data.ledger[token_id] = sp.sender

            # ----------------------------------------------------
            # FA2-compliant token metadata
            # Values must be BYTES (TZIP-12 standard)
            # ----------------------------------------------------
            token_info = {
                "name": sp.bytes("0x50617373706f7274"),  # "Passport"
                "symbol": sp.bytes("0x545a5043"),        # "TZPC"
                "decimals": sp.bytes("0x00"),            # 0
            }

            # Store token metadata
            self.data.token_metadata[token_id] = sp.record(
                token_id=token_id,
                token_info=token_info
            )

            # ----------------------------------------------------
            # Initialize passport interactive state
            # ----------------------------------------------------
            stamps = []                          # empty stamp list
            sp.cast(stamps, sp.list[sp.string])  # explicitly type it

            passport = sp.record(
                spine_color="#000000",  # default spine color (black)
                stamps=stamps,
            )
            sp.cast(passport, t_passport)

            # Save passport state on-chain
            self.data.passports[token_id] = passport

        # --------------------------------------------------------
        # Add a stamp to a passport (owner-only)
        # --------------------------------------------------------
        @sp.entrypoint
        def stamp(self, params):
            # Ensure token exists and caller owns it
            assert self.data.ledger.contains(params.token_id)
            assert self.data.ledger[params.token_id] == sp.sender

            # Load passport from storage
            passport = self.data.passports[params.token_id]

            # Add stamp to the front of the list
            passport.stamps.push(params.emoji)

            # Persist updated passport back to storage
            self.data.passports[params.token_id] = passport

        # --------------------------------------------------------
        # Change the spine color of a passport (owner-only)
        # --------------------------------------------------------
        @sp.entrypoint
        def set_spine_color(self, params):
            # Ensure token exists and caller owns it
            assert self.data.ledger.contains(params.token_id)
            assert self.data.ledger[params.token_id] == sp.sender

            # Load passport
            passport = self.data.passports[params.token_id]

            # Update spine color (expected hex string like "#RRGGBB")
            passport.spine_color = params.color

            # Persist change
            self.data.passports[params.token_id] = passport


if "main" in __name__:

    @sp.add_test()
    def test():
        scenario = sp.test_scenario("PassportNFT")
        scenario.h1("Interactive Passports")

        admin = sp.test_account("Admin")
        alice = sp.test_account("Alice")
        bob = sp.test_account("Bob")

        # Minimal FA2 initial storage (empty)
        token_metadata = sp.cast([], sp.list[sp.map[sp.string, sp.bytes]])
        ledger = {}  # ok as initial empty mapping

        contract_metadata = sp.big_map()

        c = my_module.PassportNFTContract(
            admin.address,
            contract_metadata,
            ledger,
            token_metadata
        )
        scenario += c

        # Issue (mint) 1 passport (requires 0.1ꜩ)
        c.mint_passport(_sender=alice, _amount=sp.mutez(100000))

        # Stamp it (use simple strings if your UI rejects emoji)
        c.stamp(token_id=0, emoji="hi", _sender=alice)

        # Change spine color (hex)
        c.set_spine_color(token_id=0, color="#3366FF", _sender=alice)

        # Negative test: bob can't stamp alice's passport
        c.stamp(token_id=0, emoji="nope", _sender=bob, _valid=False)
