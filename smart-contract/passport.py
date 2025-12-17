import smartpy as sp
from smartpy.templates import fa2_lib as fa2

# Import the FA2 base implementation
main = fa2.main


@sp.module
def my_module():
    import main

    # ------------------------------------------------------------
    # Define the structure of a "Postcard"
    # This is NOT token metadata — this is custom artistic state
    # ------------------------------------------------------------
    t_postcard: type = sp.record(
        background=sp.string,          # background color
        greeting=sp.string,            # greeting text
        stamps=sp.list[sp.string],     # list of emoji stamps
        # block_level=sp.nat
    )

    # ------------------------------------------------------------
    # FA2 NFT Contract with custom interactive behaviour
    # ------------------------------------------------------------
    class PostcardNFTContract(
        main.Admin,                    # admin permissions
        main.Nft,                      # FA2 NFT base
        main.MintNft,                  # minting logic
        main.BurnNft,                  # burning logic
        main.OnchainviewBalanceOf,     # balance view
    ):
        def __init__(self, admin_address, contract_metadata, ledger, token_metadata):
            # Initialize FA2 mixins (order matters)
            main.OnchainviewBalanceOf.__init__(self)
            main.BurnNft.__init__(self)
            main.MintNft.__init__(self)
            main.Nft.__init__(self, contract_metadata, ledger, token_metadata)
            main.Admin.__init__(self, admin_address)
            


            # ----------------------------------------------------
            # Custom storage for the artwork
            # ----------------------------------------------------
            self.data.postcards = sp.big_map()    # token_id -> postcard state
            self.data.next_token_id = sp.nat(0)  # auto-increment token id
            self.data.max_supply = sp.nat(5)     # hard mint limit
            self.data.mint_price = sp.mutez(100000)  # 0.1ꜩ

        # --------------------------------------------------------
        # Mint a new postcard NFT
        # --------------------------------------------------------
        @sp.entrypoint
        def mint_postcard(self):
            # Enforce total supply cap
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
                "name": sp.bytes("0x506f737463617264"),   # "Postcard"
                "symbol": sp.bytes("0x5043"),             # "PC"
                "decimals": sp.bytes("0x00"),             # 0
            }

            # Store token metadata
            self.data.token_metadata[token_id] = sp.record(
                token_id=token_id,
                token_info=token_info
            )

            # ----------------------------------------------------
            # Initialize postcard artistic state
            # ----------------------------------------------------
            stamps = []                                 # empty stamp list
            sp.cast(stamps, sp.list[sp.string])         # explicitly type it

            pc = sp.record(
                background="black",                     # default background
                greeting="Greetings from ",
                stamps=stamps,
                # block_level=sp.level
            )
            sp.cast(pc, t_postcard)                     # enforce record type

            # Save postcard state on-chain
            self.data.postcards[token_id] = pc

        # --------------------------------------------------------
        # Add an emoji stamp to a postcard
        # --------------------------------------------------------
        @sp.entrypoint
        def stamp(self, params):
            # Ensure token exists
            assert self.data.ledger.contains(params.token_id)

            # Ensure caller owns the token
            assert self.data.ledger[params.token_id] == sp.sender

            # Load postcard from storage
            pc = self.data.postcards[params.token_id]

            # Add emoji to the front of the list
            pc.stamps.push(params.emoji)

            # Write updated postcard back to storage
            self.data.postcards[params.token_id] = pc

        # --------------------------------------------------------
        # Change the background color of a postcard
        # --------------------------------------------------------
        @sp.entrypoint
        def set_background(self, params):
            # Ensure token exists
            assert self.data.ledger.contains(params.token_id)

            # Ensure caller owns the token
            assert self.data.ledger[params.token_id] == sp.sender

            # Load postcard
            pc = self.data.postcards[params.token_id]

            # Update background color
            pc.background = params.color

            # Persist change
            self.data.postcards[params.token_id] = pc

            
if "main" in __name__:

    @sp.add_test()
    def test():
        scenario = sp.test_scenario("PostcardNFT")
        scenario.h1("Interactive Postcards")

        admin = sp.test_account("Admin")
        alice = sp.test_account("Alice")
        bob = sp.test_account("Bob")

        # Minimal FA2 initial storage (empty)
        token_metadata = sp.cast([], sp.list[sp.map[sp.string, sp.bytes]])
        ledger = {}  # ok as initial empty mapping
        
        contract_metadata = sp.big_map()
        
        c = my_module.PostcardNFTContract(
            admin.address,
            contract_metadata,
            ledger,
            token_metadata
        )
        scenario += c


        # Mint 1 postcard
        c.mint_postcard(_sender=alice, _amount=sp.mutez(100000)) # remove 100k

        # Stamp it
        c.stamp(token_id=0, emoji="✨", _sender=alice)

        # Change background
        c.set_background(token_id=0, color="blue", _sender=alice)

        # Negative test: bob can't stamp alice's token
        c.stamp(token_id=0, emoji="🔥", _sender=bob, _valid=False)

